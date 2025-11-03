// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: CC0-1.0

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), "");
  const API_URL = env.VITE_API_URL || "https://api.secpal.app";

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
        manifest: {
          name: "SecPal",
          short_name: "SecPal",
          description: "Secure password management platform",
          theme_color: "#3b82f6",
          background_color: "#ffffff",
          display: "standalone",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "pwa-192x192.svg",
              sizes: "192x192",
              type: "image/svg+xml",
            },
            {
              src: "pwa-512x512.svg",
              sizes: "512x512",
              type: "image/svg+xml",
            },
            // Duplicate 512x512 entry with 'any maskable' purpose for adaptive icons
            {
              src: "pwa-512x512.svg",
              sizes: "512x512",
              type: "image/svg+xml",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          runtimeCaching: [
            {
              urlPattern: new RegExp(
                `^${API_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/.*`
              ),
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
                },
                networkTimeoutSeconds: 10,
              },
            },
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: "CacheFirst",
              options: {
                cacheName: "google-fonts-cache",
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
                },
              },
            },
          ],
        },
      }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./tests/setup.ts",
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html"],
        exclude: [
          "node_modules/",
          "tests/",
          "**/*.config.ts",
          "**/*.d.ts",
          "**/index.ts",
        ],
      },
    },
  };
});
