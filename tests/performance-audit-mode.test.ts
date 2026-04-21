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
        vi.resetModules();
        const { getPerformanceAuditMode } = await import("./e2e/performance-mode");

        expect(getPerformanceAuditMode()).toEqual({
            baseUrl: "https://app.secpal.dev",
            skipReason: undefined,
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
