// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Avoid Polyscope clone path detection so `resolvePlaywrightBaseUrl()` follows
 * the PLAYWRIGHT_BASE_URL / CI defaults these tests assert against.
 */
function mockNonPolyscopeCwd() {
  return vi.spyOn(process, "cwd").mockReturnValue("/home/runner/work/frontend");
}

describe("playwright config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("clears developer-local VITE_API_URL overrides for the local dev web server", async () => {
    // Explicitly test the local-dev path: CI must be falsy so the config
    // takes the dev-server branch and not the CI preview-server branch.
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    mockNonPolyscopeCwd();
    vi.resetModules();
    const { default: config } = await import("../playwright.config");

    const webServer =
      config.webServer && !Array.isArray(config.webServer)
        ? config.webServer
        : undefined;

    expect(webServer).toBeDefined();
    expect(webServer?.command).toBe(
      "npm run dev:android -- --host localhost --port 4174 --strictPort"
    );
    expect(webServer?.url).toBe("http://localhost:4174");
    expect(webServer?.env?.VITE_API_URL).toBe("");
    expect(webServer?.env?.VITE_APP_SURFACE).toBe("android-native");
  });

  it("treats an empty VITE_APP_SURFACE as unset for the local dev web server", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("VITE_APP_SURFACE", "");
    mockNonPolyscopeCwd();
    vi.resetModules();
    const { default: config } = await import("../playwright.config");

    const webServer =
      config.webServer && !Array.isArray(config.webServer)
        ? config.webServer
        : undefined;

    expect(webServer?.env?.VITE_APP_SURFACE).toBe("android-native");
  });

  it("pins the CI preview server to the local preview origin for browser-session audits", async () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_LIGHTHOUSE", "");
    mockNonPolyscopeCwd();
    vi.resetModules();
    const { default: config } = await import("../playwright.config");

    const webServer =
      config.webServer && !Array.isArray(config.webServer)
        ? config.webServer
        : undefined;

    expect(webServer).toBeDefined();
    expect(webServer?.command).toBe(
      "npm run build -- --mode preview && npm run preview"
    );
    expect(webServer?.url).toBe("http://localhost:4173");
    expect(webServer?.env?.VITE_API_URL).toBe("http://localhost:4173");
    expect(webServer?.env?.VITE_APP_SURFACE).toBe("android-native");
  });

  it("treats an empty VITE_APP_SURFACE as unset for the CI preview web server", async () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("VITE_APP_SURFACE", "");
    mockNonPolyscopeCwd();
    vi.resetModules();
    const { default: config } = await import("../playwright.config");

    const webServer =
      config.webServer && !Array.isArray(config.webServer)
        ? config.webServer
        : undefined;

    expect(webServer?.env?.VITE_APP_SURFACE).toBe("android-native");
  });

  it("enables a fixed chromium CDP port for preview Lighthouse audits when explicitly requested", async () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_LIGHTHOUSE", "1");
    mockNonPolyscopeCwd();
    vi.resetModules();
    const { default: config } = await import("../playwright.config");

    const chromiumProject = config.projects?.find(
      (project) => project.name === "chromium"
    );

    expect(chromiumProject).toBeDefined();
    expect(chromiumProject?.use).toBeDefined();
    expect(chromiumProject?.use?.launchOptions).toEqual({
      args: ["--remote-debugging-port=9222"],
    });
    expect(config.workers).toBe(1);
  });

  it("does not pin a fixed chromium CDP port for routine CI preview smoke runs", async () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_LIGHTHOUSE", "");
    mockNonPolyscopeCwd();
    vi.resetModules();
    const { default: config } = await import("../playwright.config");

    const chromiumProject = config.projects?.find(
      (project) => project.name === "chromium"
    );

    expect(chromiumProject).toBeDefined();
    expect(chromiumProject?.use).toBeDefined();
    expect(chromiumProject?.use?.launchOptions).toBeUndefined();
  });

  /**
   * Regression guard for issue #1121: Playwright forks every worker and the
   * webServer with a hardcoded `FORCE_COLOR=1`. If the parent shell also
   * exports `NO_COLOR` (or the legacy `NODE_DISABLE_COLORS`), Node's
   * `tty.warnOnDeactivatedColors()` spams the warning
   *   "The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set."
   * on each child. `playwright.config.ts` strips those vars from
   * `process.env` at import time so the fork inherits a clean env.
   */
  describe("color env conflict scrub (issue #1121)", () => {
    it.each([["NO_COLOR"], ["NODE_DISABLE_COLORS"]] as const)(
      "removes %s from process.env when set to a non-empty value",
      async (name) => {
        vi.stubEnv("CI", "");
        vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
        vi.stubEnv(name, "1");
        mockNonPolyscopeCwd();
        vi.resetModules();

        expect(process.env[name]).toBe("1");
        await import("../playwright.config");

        expect(process.env[name]).toBeUndefined();
      }
    );

    it.each([["NO_COLOR"], ["NODE_DISABLE_COLORS"]] as const)(
      "also removes an empty %s value to keep child env strictly clean",
      async (name) => {
        vi.stubEnv("CI", "");
        vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
        vi.stubEnv(name, "");
        mockNonPolyscopeCwd();
        vi.resetModules();

        await import("../playwright.config");

        expect(process.env[name]).toBeUndefined();
      }
    );

    it("leaves process.env untouched when neither color-disabling var is set", async () => {
      vi.stubEnv("CI", "");
      vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
      delete process.env.NO_COLOR;
      delete process.env.NODE_DISABLE_COLORS;
      mockNonPolyscopeCwd();
      vi.resetModules();

      await import("../playwright.config");

      expect(process.env.NO_COLOR).toBeUndefined();
      expect(process.env.NODE_DISABLE_COLORS).toBeUndefined();
    });
  });
});
