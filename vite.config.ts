// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: CC0-1.0

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), "");
  // Use mode-aware API URL detection:
  // - Development: empty string (Vite proxy forwards /v1/* to DDEV backend)
  // - Production: https://api.secpal.app
  // This matches the logic in src/config.ts for consistent behavior
  const API_URL =
    env.VITE_API_URL || (mode === "production" ? "https://api.secpal.app" : "");

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
          "apple-touch-icon-v3.png",
          "mask-icon.svg",
        ],
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
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            // Maskable icons with 50% safe-area padding (50% logo size)
            {
              src: "pwa-192x192-maskable-v3.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "pwa-512x512-maskable-v3.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
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
          runtimeCaching: [
            // API: Secrets List (NetworkFirst + 5min TTL)
            // Fresh data preferred, fallback to cache on network failure
            {
              urlPattern: new RegExp(
                `^${API_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/v1/secrets$`
              ),
              handler: "NetworkFirst",
              options: {
                cacheName: "api-secrets-list",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 5 * 60, // 5 minutes
                },
                networkTimeoutSeconds: 5,
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // API: Secret Details (StaleWhileRevalidate + 1h TTL)
            // Instant load from cache, background refresh
            {
              urlPattern: new RegExp(
                `^${API_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/v1/secrets/[a-zA-Z0-9_-]+$`
              ),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "api-secrets-detail",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60, // 1 hour
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // API: User Data (StaleWhileRevalidate + 1h TTL)
            {
              urlPattern: new RegExp(
                `^${API_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/v1/users.*`
              ),
              handler: "StaleWhileRevalidate",
              options: {
                cacheName: "api-users",
                expiration: {
                  maxEntries: 20,
                  maxAgeSeconds: 60 * 60, // 1 hour
                },
                cacheableResponse: {
                  statuses: [0, 200],
                },
              },
            },
            // API: Auth Endpoints (NetworkOnly - NEVER cache credentials)
            {
              urlPattern: new RegExp(
                `^${API_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/v1/auth.*`
              ),
              handler: "NetworkOnly",
            },
            // API: Other Endpoints (NetworkFirst + 24h TTL fallback)
            {
              urlPattern: new RegExp(
                `^${API_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/.*`
              ),
              handler: "NetworkFirst",
              options: {
                cacheName: "api-general",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 60 * 60 * 24, // 24 hours
                },
                networkTimeoutSeconds: 10,
                backgroundSync: {
                  name: "api-sync-queue",
                  options: {
                    maxRetentionTime: 60 * 24, // 24 hours (1440 minutes)
                  },
                },
              },
            },
            // Images (CacheFirst + 30 days TTL)
            // Rarely change, immutable with versioned URLs
            {
              urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif)(?:\?.*)?$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "images",
                expiration: {
                  maxEntries: 100,
                  maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
                },
              },
            },
            // Static Assets: JS/CSS (CacheFirst + 1 year TTL)
            // Immutable, versioned by build hash
            {
              urlPattern: /\.(?:js|css)(?:\?.*)?$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "static-assets",
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
                },
              },
            },
            // Fonts (CacheFirst + 1 year TTL)
            {
              urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/i,
              handler: "CacheFirst",
              options: {
                cacheName: "fonts",
                expiration: {
                  maxEntries: 30,
                  maxAgeSeconds: 365 * 24 * 60 * 60, // 1 year
                },
              },
            },
            // Google Fonts (CacheFirst + 1 year TTL)
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
