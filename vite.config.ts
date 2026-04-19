// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: CC0-1.0

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import babel from "@rolldown/plugin-babel";
import { lingui } from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import { fileURLToPath } from "url";
import { applyInjectManifestCodeSplittingFix } from "./src/lib/pwaInjectManifestBuildConfig";
import { buildPwaRuntimeCaching } from "./src/lib/pwaRuntimeCaching";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const vendorChunkPackages: Record<string, string[]> = {
  "vendor-react": ["react", "react-dom", "react-router-dom"],
  "vendor-ui": ["@headlessui/react", "@heroicons/react"],
  "vendor-lingui": ["@lingui/core", "@lingui/react"],
  "vendor-db": ["dexie", "dexie-react-hooks", "idb"],
  "vendor-animation": ["motion"],
  "vendor-monitoring": ["web-vitals"],
  "vendor-utils": ["clsx"],
};

function getManualChunk(moduleId: string): string | undefined {
  const normalizedModuleId = moduleId.replaceAll("\\", "/");

  if (!normalizedModuleId.includes("/node_modules/")) {
    return undefined;
  }

  for (const [chunkName, packageNames] of Object.entries(vendorChunkPackages)) {
    if (
      packageNames.some((packageName) =>
        normalizedModuleId.includes(`/node_modules/${packageName}/`)
      )
    ) {
      return chunkName;
    }
  }

  return undefined;
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [
      react({}),
      babel({
        plugins: ["@lingui/babel-plugin-lingui-macro"],
      }),
      lingui(),
      tailwindcss(),
      // Copy .htaccess from public/ to dist/ (Vite ignores dotfiles by default)
      viteStaticCopy({
        targets: [
          {
            src: "public/.htaccess",
            dest: ".",
          },
          {
            src: "config/assetlinks.json",
            dest: ".well-known",
            rename: { stripBase: true },
          },
        ],
      }),
      VitePWA({
        registerType: "prompt",
        strategies: "injectManifest",
        integration: {
          configureCustomSWViteBuild: applyInjectManifestCodeSplittingFix,
        },
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
          description:
            "Operations software for German private security services.",
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
          ],
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
          // Vite 8 requires function-based manual chunking with Rolldown.
          manualChunks: getManualChunk,
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
      testTimeout: 20000, // 20 seconds per test to keep full-suite UI tests stable under CI load
      hookTimeout: 20000, // 20 seconds for beforeEach/afterEach hooks
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
