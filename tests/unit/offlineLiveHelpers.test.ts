// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";
import { getMockCookieDomains } from "../e2e/offline-live-helpers";

/**
 * Mocks process.cwd() to a path that does not match the Polyscope clone
 * pattern, so tests that verify non-Polyscope behaviour are not affected by
 * the directory this test suite is executed from.
 */
function mockNonPolyscopeCwd() {
  return vi.spyOn(process, "cwd").mockReturnValue("/home/runner/work/frontend");
}

describe("offlineLiveHelpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("derives the live API domain when remote targets omit PLAYWRIGHT_API_BASE_URL", () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    mockNonPolyscopeCwd();

    expect(getMockCookieDomains()).toEqual([
      "app.secpal.dev",
      "api.secpal.dev",
    ]);
  });

  it("derives split workspace preview domains from POLYSCOPE_WORKSPACE", () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "grumpy-lynx");

    expect(getMockCookieDomains()).toEqual([
      "frontend-grumpy-lynx.preview.secpal.dev",
      "api-grumpy-lynx.preview.secpal.dev",
    ]);
  });

  it("canonicalizes a generic workspace preview host to split frontend/api preview domains", () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://grumpy-lynx.preview.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    mockNonPolyscopeCwd();

    expect(getMockCookieDomains()).toEqual([
      "frontend-grumpy-lynx.preview.secpal.dev",
      "api-grumpy-lynx.preview.secpal.dev",
    ]);
  });

  it("prefers the current Polyscope workspace preview domains over other remote targets", () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "https://api.secpal.dev");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "grumpy-lynx");

    expect(getMockCookieDomains()).toEqual([
      "frontend-grumpy-lynx.preview.secpal.dev",
      "api-grumpy-lynx.preview.secpal.dev",
    ]);
  });

  it("returns both app and API domains for split-host remote targets", () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "https://api.secpal.dev");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    mockNonPolyscopeCwd();

    expect(getMockCookieDomains()).toEqual([
      "app.secpal.dev",
      "api.secpal.dev",
    ]);
  });

  it("deduplicates the cookie domains when app and API share a host", () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    mockNonPolyscopeCwd();

    expect(getMockCookieDomains()).toEqual(["app.secpal.dev"]);
  });

  it("falls back to localhost for non-remote targets", () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "http://localhost:4173");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "http://localhost:8000");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    mockNonPolyscopeCwd();

    expect(getMockCookieDomains()).toEqual(["localhost"]);
  });
});
