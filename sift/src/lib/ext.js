// Extension-only glue. `browser` exists on moz-extension pages; on the web,
// PWA, and Capacitor these exports are inert.
export const isExt = typeof browser !== "undefined" && !!browser?.runtime?.id;

const KEY = "sift.v1";

// How the toolbar icon opens Sift: "tab" | "sidebar" | "popup".
// The background script watches storage.onChanged and applies it.
export async function getOpenMode() {
  if (!isExt) return null;
  try {
    return (await browser.storage.local.get("openMode")).openMode || "tab";
  } catch {
    return "tab";
  }
}

export function setOpenMode(mode) {
  if (isExt) browser.storage.local.set({ openMode: mode }).catch(() => {});
}

// Page localStorage in an extension is NOT guaranteed to survive an update or a
// "clear cookies/site data" sweep; browser.storage.local is. So we treat
// storage.local as the durable copy: hydrate localStorage from it on startup,
// mirror every save back to it. (A full uninstall still wipes both — that's why
// export/import, and later cloud sync, exist.)
export async function hydrateFromExt() {
  if (!isExt) return;
  try {
    const remote = (await browser.storage.local.get(KEY))[KEY];
    if (remote) localStorage.setItem(KEY, remote); // durable copy wins on load
  } catch { /* storage unavailable — fall back to whatever localStorage has */ }
}

export function mirrorToExt(json) {
  if (isExt) browser.storage.local.set({ [KEY]: json }).catch(() => {});
}
