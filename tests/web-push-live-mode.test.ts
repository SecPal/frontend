// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";

function mockNonPolyscopeCwd() {
  return vi.spyOn(process, "cwd").mockReturnValue("/home/runner/work/frontend");
}

describe("web push live mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it("skips when no Polyscope workspace preview is selected", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_LIVE_WEB_PUSH", "1");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    mockNonPolyscopeCwd();

    const { getLiveWebPushMode } = await import("./e2e/web-push-live-mode");

    expect(getLiveWebPushMode()).toEqual({
      baseUrl: "http://localhost:5173",
      apiBaseUrl: undefined,
      skipReason:
        "Live browser Web Push smoke only runs against the current Polyscope workspace preview (frontend-<workspace>.preview.secpal.dev). Pure live targets such as app.secpal.dev are intentionally not part of the Polyscope E2E surface.",
    });
  });

  it("skips when an explicit non-workspace HTTPS deployment target is selected", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "https://api.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_LIVE_WEB_PUSH", "1");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "");
    mockNonPolyscopeCwd();

    const { getLiveWebPushMode } = await import("./e2e/web-push-live-mode");

    // Pure live targets such as `app.secpal.dev` are no longer part of the
    // Polyscope E2E surface (issue #1199), so they are short-circuited at the
    // workspace-preview gate before the explicit opt-in flag is even checked.
    // The explicit `PLAYWRIGHT_API_BASE_URL` override is still passed through
    // verbatim because operators may legitimately need that for diagnostics.
    expect(getLiveWebPushMode()).toEqual({
      baseUrl: "https://app.secpal.dev",
      apiBaseUrl: "https://api.secpal.dev",
      skipReason:
        "Live browser Web Push smoke only runs against the current Polyscope workspace preview (frontend-<workspace>.preview.secpal.dev). Pure live targets such as app.secpal.dev are intentionally not part of the Polyscope E2E surface.",
    });
  });

  it("skips when live web push mode was not explicitly opted in on a workspace preview", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_LIVE_WEB_PUSH", "");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "grumpy-lynx");

    const { getLiveWebPushMode } = await import("./e2e/web-push-live-mode");

    expect(getLiveWebPushMode()).toEqual({
      baseUrl: "https://frontend-grumpy-lynx.preview.secpal.dev",
      apiBaseUrl: "https://api-grumpy-lynx.preview.secpal.dev",
      skipReason:
        "Live browser Web Push smoke requires PLAYWRIGHT_LIVE_WEB_PUSH=1 to avoid accidental registration changes on the workspace preview.",
    });
  });

  it("derives workspace preview app and API targets when the opt-in is enabled", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_LIVE_WEB_PUSH", "1");
    vi.stubEnv("CHROME_PATH", "/usr/bin/chromium");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "grumpy-lynx");

    const { getLiveWebPushMode } = await import("./e2e/web-push-live-mode");

    expect(getLiveWebPushMode()).toEqual({
      baseUrl: "https://frontend-grumpy-lynx.preview.secpal.dev",
      apiBaseUrl: "https://api-grumpy-lynx.preview.secpal.dev",
      skipReason: undefined,
    });
  });

  it("requires a stable Chrome or Chromium binary on the workspace preview", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_LIVE_WEB_PUSH", "1");
    vi.stubEnv("CHROME_PATH", "");
    vi.stubEnv("POLYSCOPE_WORKSPACE", "grumpy-lynx");

    const { getLiveWebPushMode } = await import("./e2e/web-push-live-mode");

    expect(getLiveWebPushMode()).toEqual({
      baseUrl: "https://frontend-grumpy-lynx.preview.secpal.dev",
      apiBaseUrl: "https://api-grumpy-lynx.preview.secpal.dev",
      skipReason:
        "Live browser Web Push smoke against https://frontend-grumpy-lynx.preview.secpal.dev requires CHROME_PATH to point to a stable Chrome/Chromium binary because the bundled Playwright Chromium snapshot denies notification permission on HTTPS targets.",
    });
  });

  it("rejects the bundled Playwright Chromium snapshot on the workspace preview", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_API_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_LIVE_WEB_PUSH", "1");
    vi.stubEnv(
      "CHROME_PATH",
      "/home/runner/.cache/ms-playwright/chromium-1234/chrome-linux/chrome"
    );
    vi.stubEnv("POLYSCOPE_WORKSPACE", "grumpy-lynx");

    const { getLiveWebPushMode } = await import("./e2e/web-push-live-mode");

    expect(getLiveWebPushMode()).toEqual({
      baseUrl: "https://frontend-grumpy-lynx.preview.secpal.dev",
      apiBaseUrl: "https://api-grumpy-lynx.preview.secpal.dev",
      skipReason:
        "Live browser Web Push smoke requires CHROME_PATH to point to a stable Chrome/Chromium binary instead of the bundled Playwright Chromium snapshot.",
    });
  });

  it("limits the live web push smoke to the desktop chromium project", async () => {
    const { getLiveWebPushProjectSkipReason } =
      await import("./e2e/web-push-live-mode");

    expect(getLiveWebPushProjectSkipReason("chromium", "chromium")).toBe(
      undefined
    );
    expect(getLiveWebPushProjectSkipReason("mobile-chrome", "chromium")).toBe(
      "Live browser Web Push smoke only runs in the desktop chromium project because notification permission and push subscription diagnostics are only collected there."
    );
    expect(getLiveWebPushProjectSkipReason("webkit", "webkit")).toBe(
      "Live browser Web Push smoke only works with Chromium"
    );
  });
});
