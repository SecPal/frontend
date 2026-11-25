// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { getMockCookieDomains } from "../e2e/offline-live-helpers";

describe("offlineLiveHelpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("only emits the frontend cookie domain when a non-workspace remote target omits PLAYWRIGHT_API_BASE_URL", () => {
    // Pure live targets such as `app.secpal.dev` are no longer part of the
    // workspace E2E surface (issue #1199), so `resolvePlaywrightApiBaseUrl`
    // no longer derives `api.secpal.dev` automatically; operators who really
    // need a paired API domain for offline-mock cookies must set
    // `PLAYWRIGHT_API_BASE_URL` themselves.
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");

    expect(getMockCookieDomains()).toEqual(["app.secpal.dev"]);
  });

  it("scopes preview cookies to the explicit workspace preview", () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://grumpy-lynx.preview.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");

    expect(getMockCookieDomains()).toEqual(["grumpy-lynx.preview.secpal.dev"]);
  });

  it.each([
    "",
    "https://api-grumpy-lynx.preview.secpal.dev",
    "https://another-workspace.preview.secpal.dev",
  ])(
    "scopes workspace preview cookies to the single origin with API override %j",
    (configuredApiBaseUrl) => {
      vi.stubEnv(
        "PLAYWRIGHT_BASE_URL",
        "https://grumpy-lynx.preview.secpal.dev"
      );
      vi.stubEnv("PLAYWRIGHT_API_BASE_URL", configuredApiBaseUrl);

      expect(getMockCookieDomains()).toEqual([
        "grumpy-lynx.preview.secpal.dev",
      ]);
    }
  );

  it("returns both app and API domains for split-host remote targets", () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "https://api.secpal.dev");

    expect(getMockCookieDomains()).toEqual([
      "app.secpal.dev",
      "api.secpal.dev",
    ]);
  });

  it("deduplicates the cookie domains when app and API share a host", () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "https://app.secpal.dev");

    expect(getMockCookieDomains()).toEqual(["app.secpal.dev"]);
  });

  it("falls back to localhost for non-remote targets", () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "http://localhost:4173");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "http://localhost:8000");

    expect(getMockCookieDomains()).toEqual(["localhost"]);
  });
});
