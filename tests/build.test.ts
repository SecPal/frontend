// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

function getIndentedSection(text: string, sectionName: string): string {
  const lines = text.split("\n");
  const startIndex = lines.findIndex(
    (line) => line.trim() === `${sectionName}:`
  );

  if (startIndex === -1) {
    return "";
  }

  const sectionIndent = lines[startIndex].match(/^ */)?.[0].length ?? 0;
  const sectionLines = [lines[startIndex]];

  for (const line of lines.slice(startIndex + 1)) {
    const lineIndent = line.match(/^ */)?.[0].length ?? 0;

    if (line.trim() !== "" && lineIndent <= sectionIndent) {
      break;
    }

    sectionLines.push(line);
  }

  return sectionLines.join("\n");
}

function expectWarningFreeShippedNginxConfigSyntax(nginxConfig: string): void {
  expect(nginxConfig).toMatch(/^\s*http2\s+on;$/mu);
  expect(nginxConfig).not.toMatch(/^\s*listen\b[^#;\n]*\bhttp2\b[^;\n]*;$/mu);
  expect(nginxConfig).not.toMatch(/^\s*ssi_types\s+text\/html;$/mu);
}

/**
 * Build Configuration and Source Verification Tests
 *
 * These tests verify that the required source files and build configuration
 * are present and contain the expected directives. They read repo source
 * files directly, except for focused regressions that intentionally run a
 * real build to verify emitted output paths.
 */
describe("Build Configuration and Source Verification", () => {
  it("keeps the Apache SPA routing file in the build inputs", () => {
    expect(existsSync(path.join(repoRoot, "public/.htaccess"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "index.html"))).toBe(true);

    const htaccess = readRepoFile("public/.htaccess");
    expect(htaccess).toContain("RewriteEngine On");
    expect(htaccess).toContain("RewriteRule . /index.html [L]");
  });

  it("ships Android Digital Asset Links for passkey trust on app.secpal.dev", () => {
    expect(existsSync(path.join(repoRoot, "config/assetlinks.json"))).toBe(
      true
    );

    const assetLinks = JSON.parse(
      readRepoFile("config/assetlinks.json")
    ) as Array<{
      relation: string[];
      target: {
        namespace: string;
        package_name: string;
        sha256_cert_fingerprints: string[];
      };
    }>;

    expect(assetLinks).toEqual([
      {
        relation: [
          "delegate_permission/common.handle_all_urls",
          "delegate_permission/common.get_login_creds",
        ],
        target: {
          namespace: "android_app",
          package_name: "app.secpal",
          sha256_cert_fingerprints: [
            "C3:E9:FD:07:69:F3:34:9B:B0:B0:56:BA:E6:69:47:23:40:E1:CB:28:66:26:DE:30:C9:C9:FA:F9:5F:1E:47:B5",
          ],
        },
      },
    ]);
  });

  it("ships a versioned Nginx config for app.secpal.dev", () => {
    expect(
      existsSync(path.join(repoRoot, "deploy/nginx/app.secpal.dev.conf"))
    ).toBe(true);

    const nginxConfig = readRepoFile("deploy/nginx/app.secpal.dev.conf");

    expect(nginxConfig).toContain("server_name app.secpal.dev;");
    expect(nginxConfig).toContain("try_files $uri $uri/ /index.html;");
    expect(nginxConfig).toContain("location ~ ^/(v1|sanctum)(/|$)");
    expect(nginxConfig).toContain("location ~ ^/health(/|$)");
  });

  it("keeps vite-plugin-static-copy configured for .htaccess", () => {
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toContain("vite-plugin-static-copy");
    expect(viteConfig).toContain('src: "public/.htaccess"');
    expect(viteConfig).toContain('dest: "."');
  });

  it("keeps timeout-minutes only on runnable quality workflow jobs", () => {
    const qualityWorkflow = readRepoFile(".github/workflows/quality.yml");
    const jobsSection = getIndentedSection(qualityWorkflow, "jobs");
    const jobNames = Array.from(
      jobsSection.matchAll(/^ {2}([a-z0-9-]+):$/gm),
      (match) => match[1]
    );

    expect(jobNames.length).toBeGreaterThan(0);

    for (const jobName of jobNames) {
      const jobSection = getIndentedSection(jobsSection, jobName);

      if (jobSection.includes("\n    uses: ")) {
        expect(jobSection).not.toContain("timeout-minutes:");
        continue;
      }

      expect(jobSection).toContain("runs-on:");
      expect(jobSection).toContain("timeout-minutes:");
    }
  });

  it("keeps the package-lock root license aligned with package.json", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      license: string;
    };
    const packageLock = JSON.parse(readRepoFile("package-lock.json")) as {
      packages?: Record<string, { license?: string }>;
    };

    expect(packageLock.packages?.[""]?.license).toBe(packageJson.license);
  });

  it("keeps explicit dev and build scripts for every app surface", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      scripts?: Record<string, string>;
    };

    expect(packageJson.scripts).toMatchObject({
      dev: "vite",
      "dev:web": "cross-env VITE_APP_SURFACE=web vite --mode web",
      "dev:android":
        "cross-env VITE_APP_SURFACE=android-native vite --mode android",
      "dev:ios": "cross-env VITE_APP_SURFACE=ios-native vite --mode ios",
      build:
        "cross-env VITE_APP_SURFACE=web tsc && cross-env VITE_APP_SURFACE=web vite build",
      "build:web":
        "cross-env VITE_APP_SURFACE=web tsc && cross-env VITE_APP_SURFACE=web vite build --mode web",
      "build:android":
        "cross-env VITE_APP_SURFACE=android-native tsc && cross-env VITE_APP_SURFACE=android-native vite build --mode android",
      "build:ios":
        "cross-env VITE_APP_SURFACE=ios-native tsc && cross-env VITE_APP_SURFACE=ios-native vite build --mode ios",
      "build:analyze":
        "cross-env VITE_APP_SURFACE=web tsc && cross-env VITE_APP_SURFACE=web vite build --mode analyze",
    });
  });

  it("commits per-surface mode env overrides", () => {
    const webEnv = readRepoFile(".env.web");
    const androidEnv = readRepoFile(".env.android");
    const iosEnv = readRepoFile(".env.ios");

    expect(webEnv).toContain("VITE_APP_SURFACE=web");
    expect(webEnv).toContain(
      "Web-targeted Vite mode builds must load the web app surface."
    );
    expect(androidEnv).toContain("VITE_APP_SURFACE=android-native");
    expect(androidEnv).toContain(
      "Android-targeted Vite mode builds must load the Android app surface."
    );
    expect(iosEnv).toContain("VITE_APP_SURFACE=ios-native");
    expect(iosEnv).toContain(
      "iOS-targeted Vite mode builds must load the iOS app surface."
    );
  });

  it("documents the app surface and shared UI source-of-truth contract", () => {
    const readme = readRepoFile("README.md");
    const envExample = readRepoFile(".env.example");

    for (const appSurface of [
      "web",
      "android-mock",
      "android-native",
      "ios-mock",
      "ios-native",
    ]) {
      expect(readme).toContain(appSurface);
      expect(envExample).toContain(appSurface);
    }

    expect(readme).toContain(
      "`frontend` is the source of truth for SecPal product design, UI, and UX"
    );
    expect(readme).toContain(
      "Android and future iOS repositories provide native OS integrations"
    );
    expect(readme).toContain("vite-plugin-pwa");
    expect(readme).toContain("Manifest");
    expect(readme).toContain("Service Worker");
    expect(readme).toContain("Workbox");
    expect(readme).toContain("src/ui");
    expect(readme).toContain("shadcn-compatible");
    expect(readme).toContain("Radix");
    expect(readme).toContain("lucide-react");
    expect(readme).toContain("Do not introduce visual rebuilds");

    expect(envExample).toContain("VITE_APP_SURFACE=web");
    expect(envExample).toContain(
      "VITE_APP_SURFACE selects only the frontend surface contract"
    );
    expect(envExample).toContain(
      "Do not use it for secrets, capabilities, security gates, or auth behavior"
    );
  });

  it("keeps API URL examples on approved SecPal domains", () => {
    const envExample = readRepoFile(".env.example");
    const deploymentDoc = readRepoFile("docs/deployment-spa-routing.md");

    expect(envExample).toContain("https://api.secpal.dev");
    expect(envExample).not.toContain("customer.example");
    expect(deploymentDoc).toContain("https://api.secpal.dev");
    expect(deploymentDoc).toContain("https://customer-api.secpal.dev");
    expect(deploymentDoc).not.toContain("customer.example");
  });

  it("keeps SecPal-owned governance files on the attribution license expression", () => {
    for (const relativePath of [
      ".pre-commit-config.yaml",
      ".yamllint.yml",
      ".github/copilot-instructions.md",
      ".github/instructions/org-shared.instructions.md",
      ".github/instructions/react-typescript.instructions.md",
      ".github/instructions/github-workflows.instructions.md",
    ]) {
      const fileContents = readRepoFile(relativePath);

      expect(fileContents).toContain("SecPal Contributors");
      expect(fileContents).toContain(
        [
          "SPDX-License-Identifier",
          "AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution",
        ].join(": ")
      );
    }
  });

  it("keeps SecPal attribution off Lukas-owned locale sidecars", () => {
    for (const relativePath of [
      "src/locales/de/messages.js.license",
      "src/locales/de/messages.po.license",
      "src/locales/en/messages.js.license",
      "src/locales/en/messages.po.license",
    ]) {
      const sidecar = readRepoFile(relativePath);

      expect(sidecar).toContain("SecPal Contributors");
      expect(sidecar).toContain(
        ["SPDX", "License-Identifier"].join("-") + ": AGPL-3.0-or-later"
      );
      expect(sidecar).not.toContain("LicenseRef-SecPal-Attribution");
    }
  });

  it("keeps auth-storage MAC payload assembly on the shared helper", () => {
    const storageService = readRepoFile("src/services/storage.ts");
    const passkeyAuthStorage = readRepoFile(
      "tests/utils/passkeyAuthStorage.ts"
    );
    const passkeysSpec = readRepoFile("tests/e2e/passkeys.spec.ts");

    expect(storageService).toContain("./authStorageEnvelope");
    expect(storageService).not.toContain("function buildEnvelopeMacPayload(");

    expect(passkeyAuthStorage).toContain("authStorageEnvelope");
    expect(passkeyAuthStorage).toContain("buildEnvelopeMacPayload(");
    expect(passkeyAuthStorage).not.toContain(
      "function buildEnvelopeMacPayload("
    );

    expect(passkeysSpec).toContain("../utils/passkeyAuthStorage");
    expect(passkeysSpec).not.toContain("function buildEnvelopeMacPayload(");
  });

  it("keeps Lighthouse performance audits on the shared authenticated E2E fixture", () => {
    const performanceSpec = readRepoFile("tests/e2e/performance.spec.ts");
    const packageJson = readRepoFile("package.json");

    expect(performanceSpec).toContain(
      'import { test, expect } from "./auth.setup"'
    );
    expect(performanceSpec).toContain("authenticatedPage: page");
    expect(packageJson).toContain(
      "PLAYWRIGHT_LIGHTHOUSE=1 PLAYWRIGHT_SKIP_GLOBAL_LOGIN=1 playwright test tests/e2e/performance.spec.ts --project=chromium"
    );
  });

  it("keeps vite-plugin-static-copy configured for assetlinks.json", () => {
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toContain("vite-plugin-static-copy");
    expect(viteConfig.split('src: "config/assetlinks.json"').length - 1).toBe(
      2
    );
    expect(viteConfig).toContain('dest: ".well-known"');
    expect(
      viteConfig
        .split('src: "config/assetlinks.json"')
        .slice(1)
        .some((block) => block.includes('dest: "."'))
    ).toBe(true);
    expect(viteConfig.split("stripBase: true").length - 1).toBe(2);
    expect(viteConfig.split('name: "assetlinks.json"').length - 1).toBe(2);
  });

  it("emits assetlinks.json at the deployed root and .well-known paths", () => {
    const distRoot = mkdtempSync(path.join(tmpdir(), "secpal-assetlinks-"));

    const safeEnv = { ...process.env };
    delete safeEnv.NODE_V8_COVERAGE;

    try {
      execFileSync(
        "npm",
        ["exec", "--", "vite", "build", "--outDir", distRoot],
        {
          cwd: repoRoot,
          stdio: "pipe",
          env: safeEnv,
        }
      );

      expect(existsSync(path.join(distRoot, "assetlinks.json"))).toBe(true);
      expect(
        existsSync(path.join(distRoot, ".well-known", "assetlinks.json"))
      ).toBe(true);
      expect(existsSync(path.join(distRoot, "config", "assetlinks.json"))).toBe(
        false
      );
      expect(
        existsSync(
          path.join(distRoot, ".well-known", "config", "assetlinks.json")
        )
      ).toBe(false);
    } finally {
      rmSync(distRoot, { recursive: true, force: true });
    }
  });

  it("scopes the Lingui macro Babel transform to files that import Lingui macros", () => {
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toContain("defineRolldownBabelPreset");
    expect(viteConfig).toContain("linguiMacroBabelPreset");
    expect(viteConfig).toContain("@lingui\\/(?:core|react)\\/macro");
    expect(viteConfig).toMatch(/rolldown\s*:\s*\{\s*filter\s*:\s*\{/);
    expect(viteConfig).toMatch(/filter\s*:\s*\{[\s\S]*\bid\s*:/);
    expect(viteConfig).toMatch(/filter\s*:\s*\{[\s\S]*\bcode\s*:/);
    expect(viteConfig).toMatch(
      /presets\s*:\s*\[\s*linguiMacroBabelPreset\s*\]/
    );
    expect(viteConfig).toContain("@lingui/babel-plugin-lingui-macro");
  });

  it("loads Lingui Vite exports through CJS-safe interop wiring", () => {
    const viteConfig = readRepoFile("vite.config.ts");
    const interopHelper = readRepoFile("linguiVitePluginInterop.ts");

    expect(viteConfig).toContain(
      'import * as linguiVitePlugin from "@lingui/vite-plugin";'
    );
    expect(viteConfig).toContain(
      'import { resolveLinguiVitePluginExports } from "./linguiVitePluginInterop";'
    );
    expect(viteConfig).toContain(
      "resolveLinguiVitePluginExports(linguiVitePlugin)"
    );
    expect(viteConfig).not.toContain(
      'import { lingui, linguiTransformerBabelPreset } from "@lingui/vite-plugin";'
    );
    expect(interopHelper).toContain('"lingui"');
    expect(interopHelper).not.toContain('"linguiTransformerBabelPreset"');
  });

  it("keeps nginx serving Digital Asset Links even when hidden directories are skipped during deploy", () => {
    const nginxConfig = readRepoFile("deploy/nginx/app.secpal.dev.conf");

    expect(nginxConfig).toContain("location = /.well-known/assetlinks.json");
    expect(nginxConfig).toContain("default_type application/json");
    expect(nginxConfig).toContain("try_files $uri /assetlinks.json =404;");
  });

  it("hardens browser responses with the required security headers", () => {
    const htaccess = readRepoFile("public/.htaccess");
    const nginxConfig = readRepoFile("deploy/nginx/app.secpal.dev.conf");

    const requiredHeaders = [
      "Content-Security-Policy",
      "Permissions-Policy",
      "Strict-Transport-Security",
      "Referrer-Policy",
      "X-Frame-Options",
      "X-Content-Type-Options",
      "Cross-Origin-Opener-Policy",
      "Cross-Origin-Resource-Policy",
      "Origin-Agent-Cluster",
      "X-Permitted-Cross-Domain-Policies",
    ];

    for (const header of requiredHeaders) {
      expect(htaccess).toContain(header);
      expect(nginxConfig).toContain(header);
    }
  });

  it("ships an enforceable CSP that fits the PWA runtime", () => {
    const htaccess = readRepoFile("public/.htaccess");
    const nginxConfig = readRepoFile("deploy/nginx/app.secpal.dev.conf");
    const viteConfig = readRepoFile("vite.config.ts");

    expect(htaccess).toContain("default-src 'self'");
    expect(htaccess).toContain("script-src 'self'");
    expect(htaccess).toContain("object-src 'none'");
    expect(htaccess).toContain("frame-ancestors 'none'");
    expect(htaccess).toContain("worker-src 'self'");
    expect(htaccess).toContain("manifest-src 'self'");
    expect(htaccess).toContain("connect-src 'self'");
    expect(htaccess).toContain("style-src 'self'");
    expect(htaccess).toContain("style-src 'self' 'unsafe-inline'");
    expect(htaccess).toContain("style-src-elem 'self' 'unsafe-inline'");
    expect(htaccess).not.toContain("nonce-%{csp_nonce}e");
    expect(htaccess).not.toContain("UNIQUE_ID");

    expect(nginxConfig).toContain("default-src 'self'");
    expect(nginxConfig).toContain("script-src 'self'");
    expect(nginxConfig).toContain("object-src 'none'");
    expect(nginxConfig).toContain("frame-ancestors 'none'");
    expect(nginxConfig).toContain("worker-src 'self'");
    expect(nginxConfig).toContain("manifest-src 'self'");
    expect(nginxConfig).toContain("connect-src 'self'");
    expect(nginxConfig).toContain("style-src 'self'");
    expect(nginxConfig).toContain("style-src-elem 'self' 'nonce-$csp_nonce'");
    expect(nginxConfig).not.toContain("style-src 'self' 'unsafe-inline'");
    expect(viteConfig).toContain("html: {");
    expect(viteConfig).toContain("cspNonce: cspNonceSsiPlaceholder");
    expect(viteConfig).toContain(
      "<!--#echo var='csp_nonce' encoding='none' -->"
    );
    expect(viteConfig).toContain(
      'globPatterns: ["**/*.{js,css,ico,png,svg,woff,woff2}"]'
    );
    expect(viteConfig).toContain(
      'globIgnores: ["**/*.html", "theme-color.js"]'
    );
    expect(viteConfig).toContain("navigateFallback: null");
    expect(viteConfig).toContain("nonceBearingHtmlShellPattern");
    expect(viteConfig).toContain("manifestTransforms");
    expect(viteConfig).not.toContain("js,css,html,ico");
  });

  it("does not precache nonce-bearing HTML shells", () => {
    const serviceWorker = readRepoFile("src/sw.ts");
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).not.toContain("html,ico");
    expect(serviceWorker).toContain("new NetworkFirst");
    expect(serviceWorker).toContain('cacheName: "html-shell"');
    expect(serviceWorker).not.toContain(
      'createHandlerBoundToURL("/index.html")'
    );
  });

  it("keeps the recovery bootstrap out of service-worker caches", () => {
    const serviceWorker = readRepoFile("src/sw.ts");
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toContain('"theme-color.js"');
    expect(serviceWorker).toContain("isCacheableStaticAssetRequest");
    expect(serviceWorker).toContain('pathname !== "/theme-color.js"');
  });

  it("uses an external theme-color bootstrap so CSP can block inline scripts", () => {
    const indexHtml = readRepoFile("index.html");

    expect(indexHtml).toContain('<script src="/theme-color.js"></script>');
    expect(indexHtml).toContain("viewport-fit=cover");
    expect(indexHtml).not.toContain("(function () {");
    expect(existsSync(path.join(repoRoot, "public/theme-color.js"))).toBe(true);

    const themeColorJs = readRepoFile("public/theme-color.js");
    expect(themeColorJs.trim().length).toBeGreaterThan(0);
    expect(themeColorJs).toContain("theme-color");
    expect(themeColorJs).not.toContain("<script");
  });

  it("keeps stale hashed-entry recovery in the early bootstrap script", () => {
    const themeColorJs = readRepoFile("public/theme-color.js");

    expect(themeColorJs).toContain("window.addEventListener(");
    expect(themeColorJs).toContain('"error"');
    expect(themeColorJs).toContain("secpal.asset-load-recovery");
    expect(themeColorJs).toContain("navigator.serviceWorker.getRegistrations");
    expect(themeColorJs).toContain("window.caches.keys");
    expect(themeColorJs).toContain("window.location.reload()");
    expect(themeColorJs).toContain("app-bootstrap-ready");
    expect(themeColorJs).not.toContain("(?:\\?.*)?$");
  });

  it("reads CSP nonces from emitted script/link tags instead of a custom meta carrier", () => {
    const nonceHelper = readRepoFile("src/lib/cspNonce.tsx");

    expect(nonceHelper).toContain("script[nonce]");
    expect(nonceHelper).toContain('link[rel="stylesheet"][nonce]');
    expect(nonceHelper).not.toContain('property="csp-nonce"');
  });

  it("adds dedicated delivery rules for service worker and manifest files", () => {
    const htaccess = readRepoFile("public/.htaccess");
    const nginxConfig = readRepoFile("deploy/nginx/app.secpal.dev.conf");

    expect(htaccess).toContain('Files "sw.js"');
    expect(htaccess).toContain("Service-Worker-Allowed");
    expect(htaccess).toContain("application/manifest+json");
    expect(htaccess).toContain("manifest.webmanifest");
    expect(htaccess).toContain("RewriteCond %{REQUEST_FILENAME} !-f");
    expect(htaccess).toContain("RewriteRule ^source-offer\\.json$ - [R=404,L]");
    expect(htaccess).toContain(
      "RewriteCond %{REQUEST_FILENAME} !-f\n  RewriteRule ^source-offer\\.json$ - [R=404,L]"
    );
    expect(htaccess).toContain('Files "source-offer.json"');
    expect(htaccess).toContain('Cache-Control "no-cache, must-revalidate"');
    expect(htaccess).toContain('Files "theme-color.js"');
    expect(htaccess).toContain(
      'Cache-Control "no-cache, no-store, must-revalidate"'
    );

    expect(nginxConfig).toContain("location = /sw.js");
    expect(nginxConfig).toContain("Service-Worker-Allowed");
    expect(nginxConfig).toContain("default_type application/manifest+json");
    expect(nginxConfig).toContain("location = /manifest.webmanifest");
    expect(nginxConfig).toContain("location = /source-offer.json");
    expect(nginxConfig).toContain("location = /theme-color.js");
    expect(nginxConfig).toContain("default_type application/json");
  });

  it("keeps the shipped nginx config free of known syntax warnings", () => {
    const nginxConfig = readRepoFile("deploy/nginx/app.secpal.dev.conf");

    expectWarningFreeShippedNginxConfigSyntax(nginxConfig);
  });

  it("rejects commented http2 toggles", () => {
    expect(() =>
      expectWarningFreeShippedNginxConfigSyntax(
        ["server {", "  listen 443 ssl;", "  # http2 on;", "}"].join("\n")
      )
    ).toThrowError();
  });

  it("rejects deprecated http2 listen parameters with extra flags", () => {
    expect(() =>
      expectWarningFreeShippedNginxConfigSyntax(
        [
          "server {",
          "  listen 443 ssl http2 reuseport;",
          "  http2 on;",
          "}",
        ].join("\n")
      )
    ).toThrowError(/listen\\b.*http2/u);
  });

  it("rejects a live ssi_types text/html override", () => {
    expect(() =>
      expectWarningFreeShippedNginxConfigSyntax(
        ["server {", "  http2 on;", "  ssi_types text/html;", "}"].join("\n")
      )
    ).toThrowError(/ssi_types/u);
  });

  it("ships a live smoke check for deployed PWA security headers", () => {
    expect(
      existsSync(path.join(repoRoot, "scripts/check-live-pwa-headers.sh"))
    ).toBe(true);
    expect(
      existsSync(
        path.join(repoRoot, "scripts/check-workspace-preview-pwa-headers.mjs")
      )
    ).toBe(true);

    const packageJson = readRepoFile("package.json");

    expect(packageJson).toContain(
      '"test:live:pwa-headers": "bash ./scripts/check-live-pwa-headers.sh"'
    );
    expect(packageJson).toContain(
      '"test:preview:pwa-headers": "node ./scripts/check-workspace-preview-pwa-headers.mjs"'
    );
  });

  it("ships a live smoke check for deployed assetlinks delivery", () => {
    expect(
      existsSync(path.join(repoRoot, "scripts/check-live-assetlinks.sh"))
    ).toBe(true);

    const packageJson = readRepoFile("package.json");

    expect(packageJson).toContain(
      '"test:live:assetlinks": "bash ./scripts/check-live-assetlinks.sh"'
    );
  });

  it("pins markdownlint-cli to the governed repo version", () => {
    const packageJson = JSON.parse(readRepoFile("package.json")) as {
      devDependencies?: Record<string, string>;
    };

    expect(packageJson.devDependencies?.["markdownlint-cli"]).toBe("0.49.0");
  });

  it("keeps PWA shortcuts limited to live routes", () => {
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toContain('url: "/profile"');
    expect(viteConfig).not.toContain('url: "/schedule"');
    expect(viteConfig).not.toContain('url: "/reports/new"');
    expect(viteConfig).not.toContain('url: "/emergency"');
  });

  it("documents the encrypted offline vault design for issue 495", () => {
    expect(
      existsSync(path.join(repoRoot, "docs/OFFLINE_ENCRYPTED_VAULT_DESIGN.md"))
    ).toBe(true);

    const offlineVaultDesign = readRepoFile(
      "docs/OFFLINE_ENCRYPTED_VAULT_DESIGN.md"
    );
    const persistenceAudit = readRepoFile("PWA_OFFLINE_PERSISTENCE_AUDIT.md");

    expect(offlineVaultDesign).toContain("# Encrypted Offline Vault Design");
    expect(offlineVaultDesign).toContain("## Target Key Hierarchy");
    expect(offlineVaultDesign).toContain("## Device-Bound Key Options");
    expect(offlineVaultDesign).toContain(
      "## Lock, Unlock, and Logout Semantics"
    );
    expect(offlineVaultDesign).toContain(
      "## Security Boundaries and UX Trade-Offs"
    );
    expect(offlineVaultDesign).toContain("## Follow-Up Implementation Slices");
    expect(persistenceAudit).toContain(
      "docs/OFFLINE_ENCRYPTED_VAULT_DESIGN.md"
    );
  });
});

/**
 * Manual Verification Checklist
 *
 * After running `npm run build`, manually verify:
 *
 * 1. dist/.htaccess exists
 * 2. dist/.htaccess contains "RewriteEngine On"
 * 3. dist/.htaccess contains "RewriteRule . /index.html [L]"
 * 4. dist/index.html exists
 *
 * Command to verify:
 * ```bash
 * npm run build && ls -la dist/.htaccess && grep "RewriteEngine On" dist/.htaccess
 * ```
 */
