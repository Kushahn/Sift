// Pre-paint theme bootstrap: sets data-theme before first render to avoid a
// light-mode flash. Lives in its own file (not inline in index.html) because
// extension pages forbid inline scripts.
try {
  var t = (JSON.parse(localStorage.getItem("sift.v1") || "{}").theme) || "auto";
  if (t === "auto") t = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  document.documentElement.dataset.theme = t;
  // extension popup gets a fixed compact width (see styles.css :root.popup)
  if (location.search.indexOf("popup") !== -1) document.documentElement.classList.add("popup");
} catch (e) { /* defaults apply */ }
