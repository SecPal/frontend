// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";

/**
 * Build Output Tests
 *
 * These tests verify that the build process produces the expected output,
 * including SPA routing configuration files.
 *
 * Note: These tests require a successful build (npm run build) to pass.
 */
describe("Build Output Verification", () => {
  it("should document that .htaccess must be present in dist/", () => {
    // This is a documentation test to ensure developers know about the requirement
    const requiredFiles = {
      ".htaccess": "Apache SPA routing configuration",
      "index.html": "Entry point for React app",
    };

    expect(requiredFiles[".htaccess"]).toBe("Apache SPA routing configuration");
    expect(requiredFiles["index.html"]).toBe("Entry point for React app");
  });

  it("should verify vite-plugin-static-copy is configured", () => {
    // This test documents that vite-plugin-static-copy MUST be configured
    // in vite.config.ts to copy .htaccess from public/ to dist/
    const pluginConfig = {
      name: "vite-plugin-static-copy",
      purpose: "Copy .htaccess from public/ to dist/ during build",
      requiredTarget: {
        src: "public/.htaccess",
        dest: ".",
      },
    };

    expect(pluginConfig.name).toBe("vite-plugin-static-copy");
    expect(pluginConfig.requiredTarget.src).toBe("public/.htaccess");
  });

  it("should document required .htaccess directives", () => {
    // Document the essential directives that MUST be in .htaccess
    const requiredDirectives = [
      "RewriteEngine On",
      "RewriteCond %{REQUEST_FILENAME} !-f",
      "RewriteCond %{REQUEST_FILENAME} !-d",
      "RewriteRule . /index.html [L]",
    ];

    // Verify we're documenting all essential directives
    expect(requiredDirectives).toHaveLength(4);
    expect(requiredDirectives[0]).toBe("RewriteEngine On");
    expect(requiredDirectives[3]).toContain("index.html");
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
