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

  it("pins the CI preview build to the preview origin for mocked browser-session E2E coverage", async () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.resetModules();
    const { default: config } = await import("../playwright.config");

    const webServer =
      config.webServer && !Array.isArray(config.webServer)
        ? config.webServer
        : undefined;

    expect(webServer).toBeDefined();
    expect(webServer?.command).toBe("npm run build && npm run preview");
    expect(webServer?.url).toBe("http://localhost:4173");
    expect(webServer?.env?.VITE_API_URL).toBe("http://localhost:4173");
  });

  it("launches the chromium project with a fixed CDP port for Lighthouse audits", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.resetModules();
    const { default: config } = await import("../playwright.config");

    const chromiumProject = config.projects?.find(
      (project) => project.name === "chromium"
    );

    expect(chromiumProject).toBeDefined();
    expect(chromiumProject?.use.launchOptions).toEqual({
      args: ["--remote-debugging-port=9222"],
    });
  });

  it("keeps the local chromium project free of a fixed CDP port so parallel E2E workers do not collide", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.resetModules();
    const { default: config } = await import("../playwright.config");

    const chromiumProject = config.projects?.find(
      (project) => project.name === "chromium"
    );

    expect(chromiumProject).toBeDefined();
    expect(chromiumProject?.use.launchOptions).toBeUndefined();
  });
});
