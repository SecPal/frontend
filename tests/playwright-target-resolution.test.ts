// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * Mocks process.cwd() to a path that does not match the Polyscope clone
 * pattern, so tests that verify non-Polyscope behaviour are not affected by
 * the directory this test suite is executed from.
 */
function mockNonPolyscopeCwd() {
  return vi.spyOn(process, "cwd").mockReturnValue("/home/runner/work/frontend");
}

describe("playwright target resolution", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("prefers the current Polyscope workspace preview domains over explicit non-preview targets", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "https://api.secpal.dev");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "grumpy-lynx");
    vi.stubEnv("CI", "");

    const { resolvePlaywrightApiBaseUrl, resolvePlaywrightBaseUrl } =
      await import("./e2e/target-urls.ts");

    expect(resolvePlaywrightBaseUrl()).toBe(
      "https://frontend-grumpy-lynx.preview.secpal.dev"
    );
    expect(resolvePlaywrightApiBaseUrl()).toBe(
      "https://api-grumpy-lynx.preview.secpal.dev"
    );
  });

  it("detects the workspace name from the Polyscope clone directory path when POLYSCOPE_WORKSPACE is not set", async () => {
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("CI", "");
    vi.spyOn(process, "cwd").mockReturnValue(
      "/home/secpal/.polyscope/clones/9d1c7856/my-feature-branch"
    );

    const {
      detectPolyscopeWorkspaceName,
      resolvePlaywrightApiBaseUrl,
      resolvePlaywrightBaseUrl,
    } = await import("./e2e/target-urls.ts");

    expect(detectPolyscopeWorkspaceName()).toBe("my-feature-branch");
    expect(resolvePlaywrightBaseUrl()).toBe(
      "https://frontend-my-feature-branch.preview.secpal.dev"
    );
    expect(resolvePlaywrightApiBaseUrl()).toBe(
      "https://api-my-feature-branch.preview.secpal.dev"
    );
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
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    mockNonPolyscopeCwd();

    const { resolvePlaywrightApiBaseUrl } =
      await import("./e2e/target-urls.ts");

    expect(resolvePlaywrightApiBaseUrl()).toBe(
      "https://api-grumpy-lynx.preview.secpal.dev"
    );
  });

  it("derives the API preview origin from an explicit generic workspace preview URL", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://grumpy-lynx.preview.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    mockNonPolyscopeCwd();

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
    expect(
      isWorkspacePreviewTarget("https://grumpy-lynx.preview.secpal.dev")
    ).toBe(true);
  });

  it("keeps localhost development defaults outside Polyscope workspaces", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    vi.stubEnv("CI", "");
    mockNonPolyscopeCwd();

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

  it("defaults remote workspace previews to the web app surface", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "grumpy-lynx");
    vi.stubEnv("PLAYWRIGHT_APP_SURFACE", "");
    vi.stubEnv("CI", "");

    const { resolvePlaywrightAppSurface, supportsAndroidProvisioningE2E } =
      await import("./e2e/target-urls.ts");

    expect(resolvePlaywrightAppSurface()).toBe("web");
    expect(supportsAndroidProvisioningE2E()).toBe(false);
  });

  it("honors an explicit Android Playwright app surface override on workspace previews", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "grumpy-lynx");
    vi.stubEnv("PLAYWRIGHT_APP_SURFACE", "android-native");
    vi.stubEnv("CI", "");

    const { resolvePlaywrightAppSurface, supportsAndroidProvisioningE2E } =
      await import("./e2e/target-urls.ts");

    expect(resolvePlaywrightAppSurface()).toBe("android-native");
    expect(supportsAndroidProvisioningE2E()).toBe(true);
  });

  it("derives the API preview URL from the frontend preview when PLAYWRIGHT_API_BASE_URL is a non-preview value", async () => {
    vi.stubEnv(
      "PLAYWRIGHT_BASE_URL",
      "https://frontend-grumpy-lynx.preview.secpal.dev"
    );
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "https://example.invalid/api");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    vi.stubEnv("CI", "");
    vi.spyOn(process, "cwd").mockReturnValue("/home/user/my-app");

    const { resolvePlaywrightApiBaseUrl } =
      await import("./e2e/target-urls.ts");

    expect(resolvePlaywrightApiBaseUrl()).toBe(
      "https://api-grumpy-lynx.preview.secpal.dev"
    );
  });

  it("returns undefined for non-preview frontend overrides because pure live targets are no longer part of the Polyscope E2E surface", async () => {
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    vi.stubEnv("CI", "");
    mockNonPolyscopeCwd();

    const { isWorkspacePreviewTarget, resolvePlaywrightApiBaseUrl } =
      await import("./e2e/target-urls.ts");

    expect(resolvePlaywrightApiBaseUrl()).toBeUndefined();
    expect(isWorkspacePreviewTarget("https://app.secpal.dev")).toBe(false);
  });
});
