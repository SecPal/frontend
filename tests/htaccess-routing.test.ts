// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const htaccessPath = path.resolve(import.meta.dirname, "../public/.htaccess");
const htaccess = readFileSync(htaccessPath, "utf8");

describe("frontend public/.htaccess", () => {
  it("fails API and Sanctum paths explicitly before the SPA fallback", () => {
    const apiGuard = "RewriteRule ^(?:v1|sanctum)(?:/|$) - [R=404,L]";
    const healthGuard = "RewriteRule ^health(?:/|$) - [R=404,L]";
    const spaFallback = "RewriteRule . /index.html [L]";

    expect(htaccess).toContain(apiGuard);
    expect(htaccess).toContain(healthGuard);
    expect(htaccess.indexOf(apiGuard)).toBeGreaterThan(-1);
    expect(htaccess.indexOf(healthGuard)).toBeGreaterThan(-1);
    expect(htaccess.indexOf(apiGuard)).toBeLessThan(
      htaccess.indexOf(spaFallback)
    );
    expect(htaccess.indexOf(healthGuard)).toBeLessThan(
      htaccess.indexOf(spaFallback)
    );
  });
});
