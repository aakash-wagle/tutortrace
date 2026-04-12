import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      devOptions: { enabled: true },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
        runtimeCaching: [
          {
            // Canvas proxy calls: serve stale when offline
            urlPattern: /\/canvas-proxy\//,
            handler: "NetworkFirst",
            options: {
              cacheName: "canvas-api-cache",
              networkTimeoutSeconds: 10,
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            // LiteLLM AI calls: never cache
            urlPattern: /\/chat\/completions/,
            handler: "NetworkOnly",
          },
        ],
      },
      manifest: false, // use public/manifest.json directly
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
  worker: {
    format: "es", // required for FlexSearch web worker as ES module
  },
});
