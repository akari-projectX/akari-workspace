import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

// Mock-only prototype: no proxy, no network. The build output (dist/) is
// a static bundle with external module scripts only (panel CSP 'self').
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
  build: { assetsInlineLimit: 0 },
});
