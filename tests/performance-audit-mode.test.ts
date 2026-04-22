// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";

describe("performance audit mode", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("runs Lighthouse audits against the preview build when explicitly enabled in CI", async () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_LIGHTHOUSE", "1");
    vi.stubEnv("PLAYWRIGHT_LIVE_LIGHTHOUSE", "");
    vi.resetModules();
    const { getPerformanceAuditMode } = await import("./e2e/performance-mode");

    expect(getPerformanceAuditMode()).toEqual({
      baseUrl: "http://localhost:4173",
      skipReason: undefined,
    });
  });

  it("skips live Lighthouse audits unless they are explicitly opted in", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_LIGHTHOUSE", "1");
    vi.stubEnv("PLAYWRIGHT_LIVE_LIGHTHOUSE", "");
    vi.resetModules();
    const { getPerformanceAuditMode } = await import("./e2e/performance-mode");

    expect(getPerformanceAuditMode()).toEqual({
      baseUrl: "https://app.secpal.dev",
      skipReason:
        "Live Lighthouse audits require PLAYWRIGHT_LIVE_LIGHTHOUSE=1 until issue #957 is resolved.",
    });
  });

  it("allows live Lighthouse audits when the explicit opt-in is set", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_LIGHTHOUSE", "1");
    vi.stubEnv("PLAYWRIGHT_LIVE_LIGHTHOUSE", "1");
    vi.stubEnv("CHROME_PATH", "/usr/bin/google-chrome-stable");
    vi.resetModules();
    const { getConfiguredLighthouseBrowserPath, getPerformanceAuditMode } =
      await import("./e2e/performance-mode");

    expect(getPerformanceAuditMode()).toEqual({
      baseUrl: "https://app.secpal.dev",
      skipReason: undefined,
    });
    expect(getConfiguredLighthouseBrowserPath()).toBe(
      "/usr/bin/google-chrome-stable"
    );
  });

  it("requires an explicit Chrome path for live Lighthouse audits", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_LIGHTHOUSE", "1");
    vi.stubEnv("PLAYWRIGHT_LIVE_LIGHTHOUSE", "1");
    vi.stubEnv("CHROME_PATH", "");
    vi.resetModules();
    const { getPerformanceAuditMode } = await import("./e2e/performance-mode");

    expect(getPerformanceAuditMode()).toEqual({
      baseUrl: "https://app.secpal.dev",
      skipReason:
        "Live Lighthouse audits against https://app.secpal.dev require CHROME_PATH to point to a stable Chrome/Chromium binary because the bundled Playwright Chromium snapshot does not support live HTTPS targets.",
    });
  });

  it("rejects the bundled Playwright Chromium snapshot for live Lighthouse audits", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.stubEnv("PLAYWRIGHT_LIGHTHOUSE", "1");
    vi.stubEnv("PLAYWRIGHT_LIVE_LIGHTHOUSE", "1");
    vi.stubEnv(
      "CHROME_PATH",
      "/home/secpal/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome"
    );
    vi.resetModules();
    const { getPerformanceAuditMode } = await import("./e2e/performance-mode");

    expect(getPerformanceAuditMode()).toEqual({
      baseUrl: "https://app.secpal.dev",
      skipReason:
        "Live Lighthouse audits require CHROME_PATH to point to a stable Chrome/Chromium binary instead of the bundled Playwright Chromium snapshot.",
    });
  });

  it("keeps stricter default Lighthouse thresholds for preview audits", async () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.resetModules();
    const { getPerformanceAuditThresholds } =
      await import("./e2e/performance-mode");

    expect(getPerformanceAuditThresholds()).toEqual({
      performance: 90,
      accessibility: 90,
      "best-practices": 90,
    });
  });

  it("uses a relaxed performance threshold for live Lighthouse targets", async () => {
    vi.stubEnv("CI", "");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "https://app.secpal.dev");
    vi.resetModules();
    const { getPerformanceAuditThresholds } =
      await import("./e2e/performance-mode");

    expect(getPerformanceAuditThresholds()).toEqual({
      performance: 85,
      accessibility: 90,
      "best-practices": 90,
    });
  });

  it("skips performance audits when Lighthouse mode was not explicitly requested", async () => {
    vi.stubEnv("CI", "true");
    vi.stubEnv("PLAYWRIGHT_BASE_URL", "");
    vi.stubEnv("PLAYWRIGHT_LIGHTHOUSE", "");
    vi.stubEnv("PLAYWRIGHT_LIVE_LIGHTHOUSE", "");
    vi.resetModules();
    const { getPerformanceAuditMode } = await import("./e2e/performance-mode");

    expect(getPerformanceAuditMode()).toEqual({
      baseUrl: "http://localhost:4173",
      skipReason:
        "Performance audits require PLAYWRIGHT_LIGHTHOUSE=1 so Chromium exposes the Lighthouse CDP port.",
    });
  });
});
