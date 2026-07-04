// Packages dist/ as a Firefox extension in extension/.
// MV2 on purpose: fully supported by Firefox (no deprecation date), and it
// gives us sidebar_action + browser_action with a 3-line background script.
import { cpSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";

const out = "extension";
const version = JSON.parse(readFileSync("package.json", "utf8")).version;

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync("dist", out, { recursive: true });

writeFileSync(
  `${out}/background.js`,
  `// Sift background: toolbar-icon open mode + reminder notifications.
// The app sets openMode via browser.storage.local; we re-wire the icon live.

let mode = "tab";

function applyMode(m) {
  mode = m;
  // a non-empty popup URL makes the icon open a popup; empty restores onClicked
  browser.browserAction.setPopup({ popup: m === "popup" ? "index.html?popup=1" : "" });
}

browser.storage.local.get("openMode").then((r) => applyMode(r.openMode || "tab"));
browser.storage.onChanged.addListener((ch, area) => {
  if (area === "local" && ch.openMode) applyMode(ch.openMode.newValue);
});

// NB: handler must stay synchronous — sidebarAction.open() only works inside
// a user-input handler, and an await would break that context.
browser.browserAction.onClicked.addListener(() => {
  if (mode === "sidebar") browser.sidebarAction.open();
  else browser.tabs.create({ url: browser.runtime.getURL("index.html") });
});

// ---- reminders (fire even with no Sift page open) -------------------------
// Mirrors reminderTime() in src/lib/notify.js — keep in sync.
function reminderTime(it) {
  if (!it.remind || it.done || it.vague || it.due == null) return null;
  let base = it.due;
  if (!it.hasTime) {
    const d = new Date(it.due);
    d.setHours(9, 0, 0, 0);
    base = d.getTime();
  }
  return base - (it.remindOffset || 0) * 60000;
}

const HOUR = 3600000;

browser.alarms.create("sift-reminders", { periodInMinutes: 1 });
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== "sift-reminders") return;
  let data;
  // the MV2 background page shares the extension origin's localStorage with the app
  try { data = JSON.parse(localStorage.getItem("sift.v1")); } catch { return; }
  if (!data || !Array.isArray(data.items)) return;
  const now = Date.now();
  const notified = (await browser.storage.local.get("notified")).notified || {};
  let changed = false;
  for (const it of data.items) {
    const at = reminderTime(it);
    if (at == null || at > now) continue;
    const key = it.id + ":" + at;
    if (key in notified) continue;
    notified[key] = now;
    changed = true;
    if (now - at < HOUR) {
      browser.notifications.create(key, {
        type: "basic",
        iconUrl: browser.runtime.getURL("icons/icon-192.png"),
        title: "Sift",
        message: it.text,
      });
    } // older than an hour: mark seen silently (no backlog spam on install)
  }
  for (const key of Object.keys(notified)) {
    if (now - notified[key] > 30 * 24 * HOUR) { delete notified[key]; changed = true; }
  }
  if (changed) browser.storage.local.set({ notified });
});
`
);

writeFileSync(
  `${out}/manifest.json`,
  JSON.stringify(
    {
      manifest_version: 2,
      name: "Sift",
      version,
      description: "Type anything — it finds its place.",
      icons: { 192: "icons/icon-192.png", 512: "icons/icon-512.png" },
      permissions: ["storage", "alarms", "notifications"],
      background: { scripts: ["background.js"] },
      browser_action: { default_icon: "icons/icon-192.png", default_title: "Open Sift" },
      sidebar_action: { default_panel: "index.html", default_title: "Sift", default_icon: "icons/icon-192.png" },
      browser_specific_settings: {
        gecko: {
          id: "sift@krist.local",
          strict_min_version: "142.0", // 142 = first release where Android also understands data_collection_permissions
          // AMO requires every new extension to declare data collection; Sift
          // is local-only and collects nothing
          data_collection_permissions: { required: ["none"] },
        },
      },
    },
    null,
    2
  ) + "\n"
);

console.log("extension/ ready.");
console.log("Try it:   Firefox -> about:debugging -> This Firefox -> Load Temporary Add-on -> extension/manifest.json");
console.log("Keep it:  zip the folder contents and install via about:addons in Firefox Dev/ESR (xpinstall.signatures.required=false)");
