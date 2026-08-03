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
import { thirdPartyDependencyNotices } from "./thirdPartyDependencyNotices";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { lingui } = resolveLinguiVitePluginExports(linguiVitePlugin);
const linguiMacroImportPattern = /@lingui\/(?:core|react)\/macro/;
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

const defaultDevProxyTarget = "http://localhost:8000";
const metaElementPattern = /[ \t]*<meta\b[^>]*\/?>[ \t]*(?:\r?\n)?/giu;
const cspHttpEquivAttributePattern =
  /\bhttp-equiv\s*=\s*(?:(["'])Content-Security-Policy\1|Content-Security-Policy(?=[\s/>]))/iu;

export function stripStaticCspForViteDev(html: string): string {
  const staticCspMetaElements = (html.match(metaElementPattern) ?? []).filter(
    (metaElement) => cspHttpEquivAttributePattern.test(metaElement)
  );

  if (staticCspMetaElements.length !== 1) {
    throw new Error(
      `Expected exactly one static Content-Security-Policy meta element, found ${staticCspMetaElements.length}.`
    );
  }

  return html.replace(metaElementPattern, (metaElement) =>
    cspHttpEquivAttributePattern.test(metaElement) ? "" : metaElement
  );
}

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

  return {
    clientApiBaseUrl: "",
    proxy: {
      "/v1": {
        target: resolvedProxyTarget,
        changeOrigin: true,
        secure: false,
      },
      "/sanctum": {
        target: resolvedProxyTarget,
        changeOrigin: true,
        secure: false,
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
  "vendor-react": ["react", "react-dom", "react-router"],
  "vendor-icons": ["lucide-react"],
  "vendor-ui": ["@base-ui/react", "class-variance-authority", "tailwind-merge"],
  "vendor-lingui": ["@lingui/core", "@lingui/react"],
  "vendor-db": ["dexie", "dexie-react-hooks", "idb"],
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
  resolveAppSurface(
    env.VITE_APP_SURFACE,
    command === "build" && mode !== "preview"
  );
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
        name: "vite-dev-csp-compatibility",
        apply: "serve",
        transformIndexHtml: {
          order: "pre",
          handler: stripStaticCspForViteDev,
        },
      },
      react({}),
      babel({
        presets: [linguiMacroBabelPreset],
      }),
      lingui(),
      tailwindcss(),
      // Copy static files that Vite ignores by default, deployment metadata,
      // and third-party notices required in every distributable artifact.
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
          {
            src: "THIRD-PARTY-NOTICES.md",
            dest: ".",
          },
          {
            src: "LICENSES/MIT.txt",
            dest: ".",
          },
        ],
      }),
      thirdPartyDependencyNotices(),
      VitePWA({
        registerType: "prompt",
        strategies: "injectManifest",
        integration: {
          configureCustomSWViteBuild: (inlineConfig) => {
            applyInjectManifestCodeSplittingFix(inlineConfig);
            inlineConfig.plugins = [
              ...(inlineConfig.plugins ?? []),
              thirdPartyDependencyNotices({ mergeExistingArtifact: true }),
            ];
          },
        },
        injectManifest: {
          globPatterns: ["**/*.{js,css,ico,png,svg,woff,woff2,md}"],
          globIgnores: [
            "**/*.html",
            "runtime-config.js",
            "theme-color.js",
            "document-language.js",
          ],
        },
        srcDir: "src",
        filename: "sw.ts",
        injectRegister: false,
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
          globPatterns: ["**/*.{js,css,ico,png,svg,woff,woff2,md}"],
          globIgnores: [
            "**/*.html",
            "runtime-config.js",
            "theme-color.js",
            "document-language.js",
          ],
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
    },
    server: {
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
      // Fork workers can intermittently fail to resolve jsdom during startup
      // even when the dependency is present. Threads share this process's
      // resolver while retaining isolated test workers.
      pool: "threads",
      // Native validation and hosted runners can both expose constrained CPUs;
      // the default worker pool can thrash and stall heavyweight build checks.
      maxWorkers: 2,
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
