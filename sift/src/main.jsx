import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { hydrateFromExt } from "./lib/ext.js";
import "./styles.css";

// In the extension, pull the durable copy into localStorage before the first
// render so load() sees it (no-op elsewhere). Mount regardless of the outcome.
hydrateFromExt().finally(() => {
  createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

// PWA: register service worker in production builds only
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => {});
  });
}
