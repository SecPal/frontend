// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

export const PREVIEW_BASE_URL = "http://localhost:4173";
export const LIGHTHOUSE_DEBUG_PORT = 9222;

type PerformanceAuditMode = {
    baseUrl: string;
    skipReason?: string;
};

const hasExplicitLighthouseMode = () => process.env.PLAYWRIGHT_LIGHTHOUSE === "1";

const isLiveHttpsTarget = (baseUrl: string) => baseUrl.startsWith("https://");

export const shouldEnableLighthouseBrowser = () => hasExplicitLighthouseMode();

export const shouldUseSingleWorker = () =>
    Boolean(process.env.CI) || hasExplicitLighthouseMode();

export const getPerformanceAuditMode = (): PerformanceAuditMode => {
    const baseUrl =
        process.env.PLAYWRIGHT_BASE_URL ||
        (process.env.CI ? PREVIEW_BASE_URL : "");

    if (!baseUrl) {
        return {
            baseUrl,
            skipReason:
                "Performance audits require CI preview or an explicit PLAYWRIGHT_BASE_URL target.",
        };
    }

    if (!hasExplicitLighthouseMode()) {
        return {
            baseUrl,
            skipReason:
                "Performance audits require PLAYWRIGHT_LIGHTHOUSE=1 so Chromium exposes the Lighthouse CDP port.",
        };
    }

    if (
        isLiveHttpsTarget(baseUrl) &&
        process.env.PLAYWRIGHT_LIVE_LIGHTHOUSE !== "1"
    ) {
        return {
            baseUrl,
            skipReason:
                "Live Lighthouse audits require PLAYWRIGHT_LIVE_LIGHTHOUSE=1 until issue #957 is resolved.",
        };
    }

    return { baseUrl, skipReason: undefined };
};
