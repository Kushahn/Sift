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
  `browser.browserAction.onClicked.addListener(() => browser.tabs.create({ url: browser.runtime.getURL("index.html") }));\n`
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
