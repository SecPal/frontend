// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";

describe("playwright target resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("uses the current Polyscope workspace preview by default", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "grumpy-lynx");
    vi.stubEnv("CI", "");

    const {
      isWorkspacePreviewTarget,
      resolvePlaywrightApiBaseUrl,
      resolvePlaywrightBaseUrl,
    } = await import("./e2e/target-urls.ts");

    expect(resolvePlaywrightBaseUrl()).toBe(
      "https://frontend-grumpy-lynx.preview.secpal.dev"
    );
    expect(resolvePlaywrightApiBaseUrl()).toBe(
      "https://api-grumpy-lynx.preview.secpal.dev"
    );
    expect(isWorkspacePreviewTarget()).toBe(true);
  });

  it("derives the API preview origin from an explicit workspace preview frontend URL", async () => {
    vi.stubEnv(
      "PLAYWRIGHT_BASE_URL",
      "https://frontend-grumpy-lynx.preview.secpal.dev"
    );
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");

    const { resolvePlaywrightApiBaseUrl } =
      await import("./e2e/target-urls.ts");

    expect(resolvePlaywrightApiBaseUrl()).toBe(
      "https://api-grumpy-lynx.preview.secpal.dev"
    );
  });

  it("derives the API preview origin from an explicit generic workspace preview URL", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://grumpy-lynx.preview.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");

    const { isWorkspacePreviewTarget, resolvePlaywrightApiBaseUrl } =
      await import("./e2e/target-urls.ts");

    expect(resolvePlaywrightApiBaseUrl()).toBe(
      "https://api-grumpy-lynx.preview.secpal.dev"
    );
    expect(
      isWorkspacePreviewTarget("https://grumpy-lynx.preview.secpal.dev")
    ).toBe(true);
  });

  it("keeps localhost development defaults outside Polyscope workspaces", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    vi.stubEnv("CI", "");

    const { resolvePlaywrightApiBaseUrl, resolvePlaywrightBaseUrl } =
      await import("./e2e/target-urls.ts");

    expect(resolvePlaywrightBaseUrl()).toBe("http://localhost:5173");
    expect(resolvePlaywrightApiBaseUrl()).toBeUndefined();
  });

  it("configures Playwright to use the workspace preview without a local web server", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "grumpy-lynx");
    vi.stubEnv("CI", "");

    const config = (await import("../playwright.config.ts")).default;

    expect(config.use?.baseURL).toBe(
      "https://frontend-grumpy-lynx.preview.secpal.dev"
    );
    expect(config.webServer).toBeUndefined();
  });
});
