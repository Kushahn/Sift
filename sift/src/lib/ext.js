// Extension-only glue. `browser` exists on moz-extension pages; on the web,
// PWA, and Capacitor these exports are inert.
export const isExt = typeof browser !== "undefined" && !!browser?.runtime?.id;

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
