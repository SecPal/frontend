// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: CC0-1.0

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import { fileURLToPath } from "url";
import { buildPwaRuntimeCaching } from "./src/lib/pwaRuntimeCaching";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react({
        babel: {
          plugins: ["macros"],
        },
      }),
      tailwindcss(),
      // Copy .htaccess from public/ to dist/ (Vite ignores dotfiles by default)
      viteStaticCopy({
        targets: [
          {
            src: "public/.htaccess",
            dest: ".",
          },
        ],
      }),
      VitePWA({
        registerType: "prompt",
        strategies: "injectManifest",
        srcDir: "src",
        filename: "sw.ts",
        injectRegister: "auto",
        includeAssets: [
          "favicon.ico",
          "apple-touch-icon-v7.png",
          "mask-icon.svg",
        ],
        manifest: {
          name: "SecPal",
          short_name: "SecPal",
          description: "Secure password management platform",
          theme_color: "#ffffff",
          background_color: "#52525b",
          display: "standalone",
          scope: "/",
          start_url: "/",
          icons: [
            {
              src: "pwa-192x192-maskable.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any maskable",
            },
            {
              src: "pwa-512x512-maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
          shortcuts: [
            {
              name: "View Schedule",
              short_name: "Schedule",
              description: "View your current work schedule",
              url: "/schedule",
              icons: [
                {
                  src: "pwa-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
              ],
            },
            {
              name: "Quick Report",
              short_name: "Report",
              description: "Create a new incident report",
              url: "/reports/new",
              icons: [
                {
                  src: "pwa-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
              ],
            },
            {
              name: "My Profile",
              short_name: "Profile",
              description: "View and edit your profile",
              url: "/profile",
              icons: [
                {
                  src: "pwa-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
              ],
            },
            {
              name: "Emergency Contact",
              short_name: "Emergency",
              description: "Quick access to emergency contacts",
              url: "/emergency",
              icons: [
                {
                  src: "pwa-192x192.png",
                  sizes: "192x192",
                  type: "image/png",
                },
              ],
            },
          ],
          share_target: {
            action: "/share",
            method: "POST",
            enctype: "multipart/form-data",
            params: {
              title: "title",
              text: "text",
              url: "url",
              files: [
                {
                  name: "files",
                  accept: ["image/*", "application/pdf", ".doc", ".docx"],
                },
              ],
            },
          },
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff,woff2}"],
          // Enable navigation fallback for SPA offline support
          navigateFallback: "/index.html",
          navigateFallbackDenylist: [/^\/v1\//, /^\/__/], // Exclude API and Vite internal routes from SPA fallback
          cleanupOutdatedCaches: true,
          runtimeCaching: buildPwaRuntimeCaching(),
        },
      }),
      // Bundle size visualizer (only in analyze mode)
      mode === "analyze" &&
        visualizer({
          open: true,
          gzipSize: true,
          brotliSize: true,
          filename: "dist/stats.html",
        }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Object-based manual chunks (proven to work with Heroicons)
          // Using explicit package names ensures proper module resolution
          manualChunks: {
            // React ecosystem (largest vendor chunk)
            "vendor-react": ["react", "react-dom", "react-router-dom"],
            // UI Component libraries (must stay together for proper exports)
            "vendor-ui": ["@headlessui/react", "@heroicons/react"],
            // Internationalization
            "vendor-lingui": ["@lingui/core", "@lingui/react"],
            // Database libraries
            "vendor-db": ["dexie", "dexie-react-hooks", "idb"],
            // Animation library
            "vendor-animation": ["motion"],
            // Web Vitals monitoring
            "vendor-monitoring": ["web-vitals"],
            // Utilities
            "vendor-utils": ["clsx"],
          },
        },
      },
      // Set chunk size warning limit
      chunkSizeWarningLimit: 500, // Warn if any chunk exceeds 500KB
    },
    server: {
      // Allow DDEV hostnames for local development
      allowedHosts: [".ddev.site"],
      // Proxy API requests to DDEV backend to avoid CORS issues in local development
      // This allows frontend on localhost:5173 to communicate with backend on secpal-api.ddev.site
      // without cross-origin restrictions.
      // Only active when VITE_API_URL is not explicitly set.
      proxy: !env.VITE_API_URL
        ? {
            "/v1": {
              target: "https://secpal-api.ddev.site",
              changeOrigin: true,
              secure: false, // Accept self-signed DDEV certificates
              // Add headers to help Sanctum recognize the request origin
              headers: {
                Origin: "http://localhost:5173",
                Referer: "http://localhost:5173/",
              },
            },
            "/sanctum": {
              target: "https://secpal-api.ddev.site",
              changeOrigin: true,
              secure: false,
              headers: {
                Origin: "http://localhost:5173",
                Referer: "http://localhost:5173/",
              },
            },
            "/health": {
              target: "https://secpal-api.ddev.site",
              changeOrigin: true,
              secure: false,
            },
          }
        : undefined,
    },
    test: {
      globals: true,
      environment: "jsdom",
      setupFiles: "./tests/setup.ts",
      clearMocks: true,
      unstubGlobals: true,
      unstubEnvs: true,
      testTimeout: 10000, // 10 seconds per test (default is 5s)
      hookTimeout: 10000, // 10 seconds for beforeEach/afterEach hooks
      // Exclude Playwright E2E tests (run separately via npm run test:e2e)
      exclude: ["**/node_modules/**", "**/dist/**", "**/tests/e2e/**"],
      coverage: {
        provider: "v8",
        reporter: ["text", "json", "html", "lcov", "clover"],
        exclude: [
          "node_modules/",
          "tests/",
          "**/*.config.ts",
          "**/*.d.ts",
          "**/index.ts",
        ],
        reportsDirectory: "./coverage",
      },
    },
  };
});
