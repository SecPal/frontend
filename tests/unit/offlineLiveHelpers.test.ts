// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { getMockCookieDomains } from "../e2e/offline-live-helpers";

describe("offlineLiveHelpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

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
