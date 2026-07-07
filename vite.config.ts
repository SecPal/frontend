// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: CC0-1.0

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import babel, { defineRolldownBabelPreset } from "@rolldown/plugin-babel";
import linguiMacroBabelPlugin from "@lingui/babel-plugin-lingui-macro";
import * as linguiVitePlugin from "@lingui/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";
import { viteStaticCopy } from "vite-plugin-static-copy";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";
import { fileURLToPath } from "url";
import type { ProxyOptions } from "vite";
import { resolveLinguiVitePluginExports } from "./linguiVitePluginInterop";
import { applyInjectManifestCodeSplittingFix } from "./src/lib/pwaInjectManifestBuildConfig";
import { buildPwaRuntimeCaching } from "./src/lib/pwaRuntimeCaching";
import { resolveAppSurface } from "./src/platform/appSurfaceContract";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { lingui } = resolveLinguiVitePluginExports(linguiVitePlugin);
const linguiMacroImportPattern = /@lingui\/(?:core|react)\/macro/;
const cspNonceSsiPlaceholder = "<!--#echo var='csp_nonce' encoding='none' -->";
const nonceBearingHtmlShellPattern = /\.html$/;
const linguiMacroBabelPreset = defineRolldownBabelPreset({
  preset: [
    () => ({
      plugins: [linguiMacroBabelPlugin],
    }),
  ],
  rolldown: {
    filter: {
      id: /\.[jt]sx?$/,
      code: linguiMacroImportPattern,
    },
  },
});

const ddevProxyHeaders = {
  Origin: "http://localhost:5173",
  Referer: "http://localhost:5173/",
} as const;

const defaultDevProxyTarget = "https://secpal-api.ddev.site";

function normalizeAbsoluteProxyTarget(
  value: string | undefined
): string | null {
  const trimmedValue = value?.trim() ?? "";

  if (!trimmedValue) {
    return null;
  }

  try {
    const normalizedUrl = new URL(trimmedValue);

    if (
      normalizedUrl.protocol !== "http:" &&
      normalizedUrl.protocol !== "https:"
    ) {
      return null;
    }

    return normalizedUrl.origin;
  } catch {
    return null;
  }
}

export function buildDevServerProxyConfig(configuredApiBaseUrl?: string): {
  clientApiBaseUrl: string;
  proxy: Record<string, ProxyOptions>;
} {
  const resolvedProxyTarget =
    normalizeAbsoluteProxyTarget(configuredApiBaseUrl) ?? defaultDevProxyTarget;
  const useDdevHeaders = resolvedProxyTarget === defaultDevProxyTarget;

  return {
    clientApiBaseUrl: "",
    proxy: {
      "/v1": {
        target: resolvedProxyTarget,
        changeOrigin: true,
        secure: false,
        ...(useDdevHeaders ? { headers: ddevProxyHeaders } : {}),
      },
      "/sanctum": {
        target: resolvedProxyTarget,
        changeOrigin: true,
        secure: false,
        ...(useDdevHeaders ? { headers: ddevProxyHeaders } : {}),
      },
      "/health": {
        target: resolvedProxyTarget,
        changeOrigin: true,
        secure: false,
      },
    },
  };
}

const vendorChunkPackages: Record<string, string[]> = {
  "vendor-react": ["react", "react-dom", "react-router-dom"],
  "vendor-icons": ["lucide-react"],
  "vendor-ui": [
    "@radix-ui/react-checkbox",
    "@radix-ui/react-dialog",
    "@radix-ui/react-dropdown-menu",
    "@radix-ui/react-label",
    "@radix-ui/react-popover",
    "@radix-ui/react-progress",
    "@radix-ui/react-radio-group",
    "@radix-ui/react-select",
    "@radix-ui/react-switch",
    "class-variance-authority",
    "input-otp",
    "tailwind-merge",
  ],
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
export default defineConfig(({ mode, command }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), "");
  resolveAppSurface(env.VITE_APP_SURFACE, command === "build");
  const isCi = Boolean(process.env.CI);
  const devServerProxyConfig =
    command === "serve" ? buildDevServerProxyConfig(env.VITE_API_URL) : null;
  return {
    define: devServerProxyConfig
      ? {
          "import.meta.env.VITE_API_URL": JSON.stringify(
            devServerProxyConfig.clientApiBaseUrl
          ),
        }
      : undefined,
    plugins: [
      {
        name: "strip-vite-csp-meta-carrier",
        transformIndexHtml: {
          order: "post",
          handler(html) {
            return html.replace(
              /\s*<meta property="csp-nonce" nonce="[^"]*">\s*/g,
              "\n"
            );
          },
        },
      },
      react({}),
      babel({
        presets: [linguiMacroBabelPreset],
      }),
      lingui(),
      tailwindcss(),
      // Copy static files that Vite ignores by default:
      // - .htaccess (dotfile from public/) and assetlinks.json (Android Digital Asset Links)
      viteStaticCopy({
        targets: [
          {
            src: "public/.htaccess",
            dest: ".",
          },
          {
            src: "config/assetlinks.json",
            dest: ".well-known",
            rename: {
              stripBase: true,
              name: "assetlinks.json",
            },
          },
          {
            src: "config/assetlinks.json",
            dest: ".",
            rename: {
              stripBase: true,
              name: "assetlinks.json",
            },
          },
        ],
      }),
      VitePWA({
        registerType: "prompt",
        strategies: "injectManifest",
        integration: {
          configureCustomSWViteBuild: applyInjectManifestCodeSplittingFix,
        },
        injectManifest: {
          globPatterns: ["**/*.{js,css,ico,png,svg,woff,woff2}"],
          globIgnores: ["**/*.html", "theme-color.js"],
          manifestTransforms: [
            async (entries) => ({
              manifest: entries.filter(
                (entry) => !nonceBearingHtmlShellPattern.test(entry.url)
              ),
              warnings: [],
            }),
          ],
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
          globPatterns: ["**/*.{js,css,ico,png,svg,woff,woff2}"],
          globIgnores: ["**/*.html", "theme-color.js"],
          navigateFallback: null,
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
    html: {
      cspNonce: cspNonceSsiPlaceholder,
    },
    build: {
      rollupOptions: {
        output: {
          // Manual chunking is configured via a function (Rollup/Rolldown output API).
          manualChunks: getManualChunk,
        },
      },
      // Set chunk size warning limit
      chunkSizeWarningLimit: 500, // Warn if any chunk exceeds 500KB
    },
    // `vite preview` defaults to localhost-only; bind on all interfaces so the
    // app is reachable from port forwarding, containers, and IDE-embedded browsers.
    preview: {
      host: true,
      port: 4173,
      strictPort: true,
      allowedHosts: [".ddev.site"],
    },
    server: {
      // Allow DDEV hostnames for local development
      allowedHosts: [".ddev.site"],
      // Local Vite serve mode always proxies API traffic so the browser stays
      // same-origin and never talks cross-origin to preview/customer APIs.
      proxy: devServerProxyConfig?.proxy,
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
      // Hosted runners expose 2 vCPUs; under parallel workflow load, the default
      // worker pool can thrash and stall the suite tail (frontend#1233).
      ...(isCi ? { maxWorkers: 2 } : {}),
      // Exclude Playwright E2E tests (run separately via npm run test:e2e)
      exclude: ["**/node_modules/**", "**/dist/**", "**/tests/e2e/**"],
      coverage: {
        provider: "v8",
        reporter: isCi
          ? ["text", "lcov", "clover"]
          : ["text", "json", "html", "lcov", "clover"],
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
