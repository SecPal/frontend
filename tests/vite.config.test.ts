// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it } from "vitest";

describe("vite config dev proxy", () => {
  afterEach(() => {
    delete process.env.CI;
  });

  it("uses the configured preview API as the local dev proxy target and hides it from browser runtime config", async () => {
    const { buildDevServerProxyConfig } = await import("../vite.config");

    expect(
      buildDevServerProxyConfig(
        "https://api-lively-squid-213c0bc5.preview.secpal.dev"
      )
    ).toEqual({
      clientApiBaseUrl: "",
      proxy: {
        "/health": {
          changeOrigin: true,
          secure: false,
          target: "https://api-lively-squid-213c0bc5.preview.secpal.dev",
        },
        "/sanctum": {
          changeOrigin: true,
          secure: false,
          target: "https://api-lively-squid-213c0bc5.preview.secpal.dev",
        },
        "/v1": {
          changeOrigin: true,
          secure: false,
          target: "https://api-lively-squid-213c0bc5.preview.secpal.dev",
        },
      },
    });
  });

  it("keeps the DDEV proxy defaults when no API base URL is configured", async () => {
    const { buildDevServerProxyConfig } = await import("../vite.config");

    expect(buildDevServerProxyConfig("")).toEqual({
      clientApiBaseUrl: "",
      proxy: {
        "/health": {
          changeOrigin: true,
          secure: false,
          target: "https://secpal-api.ddev.site",
        },
        "/sanctum": {
          changeOrigin: true,
          headers: {
            Origin: "http://localhost:5173",
            Referer: "http://localhost:5173/",
          },
          secure: false,
          target: "https://secpal-api.ddev.site",
        },
        "/v1": {
          changeOrigin: true,
          headers: {
            Origin: "http://localhost:5173",
            Referer: "http://localhost:5173/",
          },
          secure: false,
          target: "https://secpal-api.ddev.site",
        },
      },
    });
  });
});
