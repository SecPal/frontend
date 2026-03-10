// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { buildPwaRuntimeCaching } from "./pwaRuntimeCaching";

describe("buildPwaRuntimeCaching", () => {
  it("does not runtime-cache authenticated API routes", () => {
    const rules = buildPwaRuntimeCaching();

    const rulePatterns = rules.map((rule) => rule.urlPattern.toString());

    expect(rulePatterns.some((pattern) => pattern.includes("/v1/"))).toBe(
      false
    );
    expect(
      rulePatterns.some((pattern) => pattern.toLowerCase().includes("sanctum"))
    ).toBe(false);
  });

  it("keeps static asset runtime caching for the app shell", () => {
    const cacheNames = buildPwaRuntimeCaching()
      .map((rule) => rule.options?.cacheName)
      .filter((cacheName): cacheName is string => Boolean(cacheName));

    expect(cacheNames).toEqual(
      expect.arrayContaining([
        "images",
        "static-assets",
        "fonts",
        "google-fonts-cache",
      ])
    );
  });
});
