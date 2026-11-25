// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  isWorkspacePreviewTarget,
  resolvePlaywrightApiBaseUrl,
  resolvePlaywrightAppSurface,
  resolvePlaywrightBaseUrl,
} from "./e2e/target-urls.ts";

const preview = "https://grumpy-lynx.preview.secpal.dev";

describe("Playwright targets", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the explicit private preview for the frontend and API", () => {
    const env = {
      PLAYWRIGHT_BASE_URL: preview,
      PLAYWRIGHT_API_BASE_URL: "https://api.secpal.dev",
    };

    expect(resolvePlaywrightBaseUrl(env)).toBe(preview);
    expect(resolvePlaywrightApiBaseUrl(env)).toBe(preview);
    expect(resolvePlaywrightAppSurface(env)).toBe("web");
    expect(isWorkspacePreviewTarget(preview)).toBe(true);
  });

  it.each([
    "http://workspace.preview.secpal.dev",
    "https://api-workspace.preview.secpal.dev",
    "https://app.secpal.dev",
    "https://workspace.preview.secpal.dev.example.invalid",
    "https://workspace.preview.secpal.dev:8080",
    "https://user@workspace.preview.secpal.dev",
  ])("rejects %s for private preview tests", (url) => {
    expect(isWorkspacePreviewTarget(url)).toBe(false);
  });

  it("keeps CI and local defaults and accepts explicitly scoped local API overrides", () => {
    expect(resolvePlaywrightBaseUrl({})).toBe("http://localhost:5173");
    expect(resolvePlaywrightBaseUrl({ CI: "true" })).toBe(
      "http://localhost:4173"
    );
    expect(resolvePlaywrightApiBaseUrl({})).toBeUndefined();
    expect(
      resolvePlaywrightApiBaseUrl({
        PLAYWRIGHT_API_BASE_URL: "http://localhost:8000",
      })
    ).toBe("http://localhost:8000");
    expect(
      resolvePlaywrightAppSurface({
        PLAYWRIGHT_BASE_URL: "https://localhost:5173",
      })
    ).toBe("android-native");
    expect(
      resolvePlaywrightAppSurface({
        PLAYWRIGHT_BASE_URL: preview,
        PLAYWRIGHT_APP_SURFACE: "android-mock",
      })
    ).toBe("android-mock");
  });

  it("uses the workspace preview without starting a local server", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", preview);
    vi.stubEnv("PLAYWRIGHT_APP_SURFACE", "");
    const config = (await import("../playwright.config.ts")).default;

    expect(config.use?.baseURL).toBe(preview);
    expect(config.webServer).toBeUndefined();
  });
});
