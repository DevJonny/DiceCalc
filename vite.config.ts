import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    // Skip the PWA plugin under Vitest — it only matters at build time.
    ...(process.env.VITEST
      ? []
      : [
          VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["favicon.svg", "apple-touch-icon.png"],
            manifest: {
              name: "DiceCalc",
              short_name: "DiceCalc",
              description: "Warhammer dice probability calculator",
              theme_color: "#0f1115",
              background_color: "#0f1115",
              display: "standalone",
              orientation: "portrait",
              icons: [
                { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
                { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
                {
                  src: "pwa-maskable-512x512.png",
                  sizes: "512x512",
                  type: "image/png",
                  purpose: "maskable",
                },
              ],
            },
          }),
        ]),
  ],
  base: process.env.GITHUB_PAGES === "true" ? "/DiceCalc/" : "/",
  test: {
    environment: "node",
    globals: true,
  },
});
