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
describe("Build Output Verification", () => {
  it("keeps the Apache SPA routing file in the build inputs", () => {
    expect(existsSync(path.join(repoRoot, "public/.htaccess"))).toBe(true);
    expect(existsSync(path.join(repoRoot, "index.html"))).toBe(true);
  });

  it("keeps vite-plugin-static-copy configured for .htaccess", () => {
    const viteConfig = readRepoFile("vite.config.ts");

    expect(viteConfig).toContain("vite-plugin-static-copy");
    expect(viteConfig).toContain('src: "public/.htaccess"');
    expect(viteConfig).toContain('dest: "."');
  });

  it("hardens browser responses with the required security headers", () => {
    const htaccess = readRepoFile("public/.htaccess");

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
    }
  });

  it("ships an enforceable CSP that fits the PWA runtime", () => {
    const htaccess = readRepoFile("public/.htaccess");

    expect(htaccess).toContain("default-src 'self'");
    expect(htaccess).toContain("script-src 'self'");
    expect(htaccess).toContain("object-src 'none'");
    expect(htaccess).toContain("frame-ancestors 'none'");
    expect(htaccess).toContain("worker-src 'self'");
    expect(htaccess).toContain("manifest-src 'self'");
    expect(htaccess).toContain("connect-src 'self'");
  });

  it("uses an external theme-color bootstrap so CSP can block inline scripts", () => {
    const indexHtml = readRepoFile("index.html");

    expect(indexHtml).toContain('<script src="/theme-color.js"></script>');
    expect(indexHtml).not.toContain("(function () {");
    expect(existsSync(path.join(repoRoot, "public/theme-color.js"))).toBe(true);
  });

  it("adds dedicated delivery rules for service worker and manifest files", () => {
    const htaccess = readRepoFile("public/.htaccess");

    expect(htaccess).toContain('Files "sw.js"');
    expect(htaccess).toContain("Service-Worker-Allowed");
    expect(htaccess).toContain("application/manifest+json");
    expect(htaccess).toContain("manifest.webmanifest");
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
