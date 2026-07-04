import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // relative base so the same dist/ runs at a web root, inside the Capacitor
  // shell, and as a Firefox extension page
  base: "./",
  plugins: [react()],
});
