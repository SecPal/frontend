// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");

function readRepoFile(relativePath: string): string {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

/**
 * Build Configuration and Source Verification Tests
 *
 * These tests verify that the required source files and build configuration
 * are present and contain the expected directives. They read repo source
 * files directly and do not require a prior build step to pass.
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

  it("keeps live Lighthouse CI provisioned with a stable Chrome binary", () => {
    const liveLighthouseWorkflow = readRepoFile(
      ".github/workflows/playwright-live-lighthouse.yml"
    );

    expect(liveLighthouseWorkflow).toContain(
      "name: Playwright Live Lighthouse"
    );
    expect(liveLighthouseWorkflow).toContain(
      "browser-actions/setup-chrome@4f8e94349a351df0f048634f25fec36c3c91eded"
    );
    expect(liveLighthouseWorkflow).toContain("id: setup-chrome");
    expect(liveLighthouseWorkflow).toContain("chrome-version: stable");
    expect(liveLighthouseWorkflow).toContain(
      "CHROME_PATH: ${{ steps.setup-chrome.outputs.chrome-path }}"
    );
    expect(liveLighthouseWorkflow).toContain(
      "TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}"
    );
    expect(liveLighthouseWorkflow).toContain(
      "TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}"
    );
    expect(liveLighthouseWorkflow).toContain(
      "npm run test:e2e:performance:staging"
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
    expect(
      viteConfig.split('rename: "assetlinks.json"').length - 1
    ).toBe(2);
  });

  it("scopes the Lingui macro Babel transform to files that import Lingui macros", () => {
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toMatch(/\blinguiTransformerBabelPreset\b/);
    expect(viteConfig).toMatch(
      /presets\s*:\s*\[\s*linguiTransformerBabelPreset\(\)\s*\]/
    );
    expect(viteConfig).not.toMatch(/@lingui\/babel-plugin-lingui-macro/);
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

    expect(htaccess).toContain("default-src 'self'");
    expect(htaccess).toContain("script-src 'self'");
    expect(htaccess).toContain("object-src 'none'");
    expect(htaccess).toContain("frame-ancestors 'none'");
    expect(htaccess).toContain("worker-src 'self'");
    expect(htaccess).toContain("manifest-src 'self'");
    expect(htaccess).toContain("connect-src 'self'");

    expect(nginxConfig).toContain("default-src 'self'");
    expect(nginxConfig).toContain("script-src 'self'");
    expect(nginxConfig).toContain("object-src 'none'");
    expect(nginxConfig).toContain("frame-ancestors 'none'");
    expect(nginxConfig).toContain("worker-src 'self'");
    expect(nginxConfig).toContain("manifest-src 'self'");
    expect(nginxConfig).toContain("connect-src 'self'");
  });

  it("uses an external theme-color bootstrap so CSP can block inline scripts", () => {
    const indexHtml = readRepoFile("index.html");

    expect(indexHtml).toContain('<script src="/theme-color.js"></script>');
    expect(indexHtml).not.toContain("(function () {");
    expect(existsSync(path.join(repoRoot, "public/theme-color.js"))).toBe(true);

    const themeColorJs = readRepoFile("public/theme-color.js");
    expect(themeColorJs.trim().length).toBeGreaterThan(0);
    expect(themeColorJs).toContain("theme-color");
    expect(themeColorJs).not.toContain("<script");
  });

  it("adds dedicated delivery rules for service worker and manifest files", () => {
    const htaccess = readRepoFile("public/.htaccess");
    const nginxConfig = readRepoFile("deploy/nginx/app.secpal.dev.conf");

    expect(htaccess).toContain('Files "sw.js"');
    expect(htaccess).toContain("Service-Worker-Allowed");
    expect(htaccess).toContain("application/manifest+json");
    expect(htaccess).toContain("manifest.webmanifest");

    expect(nginxConfig).toContain("location = /sw.js");
    expect(nginxConfig).toContain("Service-Worker-Allowed");
    expect(nginxConfig).toContain("default_type application/manifest+json");
    expect(nginxConfig).toContain("location = /manifest.webmanifest");
  });

  it("ships a live smoke check for deployed PWA security headers", () => {
    expect(
      existsSync(path.join(repoRoot, "scripts/check-live-pwa-headers.sh"))
    ).toBe(true);

    const packageJson = readRepoFile("package.json");

    expect(packageJson).toContain(
      '"test:live:pwa-headers": "bash ./scripts/check-live-pwa-headers.sh"'
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

  it("keeps PWA shortcuts limited to live routes", () => {
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toContain('url: "/profile"');
    expect(viteConfig).not.toContain('url: "/schedule"');
    expect(viteConfig).not.toContain('url: "/reports/new"');
    expect(viteConfig).not.toContain('url: "/emergency"');
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
