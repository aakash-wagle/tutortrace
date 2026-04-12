import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const llmProxyTarget = env.LLM_PROXY_TARGET?.trim();
  const llmBase = env.VITE_LLM_BASE_URL?.trim() ?? "";
  const useLlmDevProxy = Boolean(llmProxyTarget && llmBase.startsWith("/"));

  return {
    plugins: [
      react(),
      VitePWA({
        registerType: "autoUpdate",
        devOptions: { enabled: true },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          runtimeCaching: [
            {
              urlPattern: /\/canvas-proxy\//,
              handler: "NetworkFirst",
              options: {
                cacheName: "canvas-api-cache",
                networkTimeoutSeconds: 10,
                expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 },
              },
            },
            {
              urlPattern: /\/chat\/completions/,
              handler: "NetworkOnly",
            },
          ],
        },
        manifest: false,
      }),
    ],
    resolve: {
      alias: { "@": path.resolve(__dirname, "./src") },
    },
    worker: {
      format: "es",
    },
    server: useLlmDevProxy
      ? {
          proxy: {
            "/api/llm": {
              target: llmProxyTarget!.replace(/\/$/, ""),
              changeOrigin: true,
              rewrite: (p) => p.replace(/^\/api\/llm/, ""),
              configure: (proxy, _options) => {
                proxy.on("proxyReq", (proxyReq, req, _res) => {
                  proxyReq.removeHeader("origin");
                  proxyReq.removeHeader("referer");
                });
              },
            },
          },
        }
      : {},
  };
});
