// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";

describe("playwright config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("clears developer-local VITE_API_URL overrides for the local dev web server", async () => {
    // Explicitly test the local-dev path: CI must be falsy so the config
    // takes the dev-server branch and not the CI preview-server branch.
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.resetModules();
    const { default: config } = await import("../playwright.config");

    const webServer =
      config.webServer && !Array.isArray(config.webServer)
        ? config.webServer
        : undefined;

    expect(webServer).toBeDefined();
    expect(webServer?.command).toBe("npm run dev");
    expect(webServer?.url).toBe("http://localhost:5173");
    expect(webServer?.env?.VITE_API_URL).toBe("");
  });
});
