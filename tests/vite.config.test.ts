// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, describe, expect, it, vi } from "vitest";

describe("vite config dev proxy", () => {
  afterEach(() => {
    delete process.env.CI;
    delete process.env.VITE_APP_SURFACE;
    vi.resetModules();
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

  it("keeps the DDEV proxy defaults when the API base URL env is missing", async () => {
    const { buildDevServerProxyConfig } = await import("../vite.config");

    expect(buildDevServerProxyConfig(undefined)).toEqual(
      buildDevServerProxyConfig("")
    );
  });
});

describe("vite config surface validation", () => {
  afterEach(() => {
    delete process.env.VITE_APP_SURFACE;
    vi.resetModules();
  });

  it.each(["android-mock", "ios-mock"] as const)(
    "rejects %s before a production artifact can be emitted",
    async (configuredSurface) => {
      process.env.VITE_APP_SURFACE = configuredSurface;
      const { default: viteConfig } = await import("../vite.config");

      expect(() =>
        typeof viteConfig === "function"
          ? viteConfig({
              command: "build",
              mode: "web",
              isPreview: false,
              isSsrBuild: false,
            })
          : viteConfig
      ).toThrow(
        `VITE_APP_SURFACE value "${configuredSurface}" is not allowed in production builds. Use a native or web surface.`
      );
    }
  );

  it("allows android-mock for local preview build validation", async () => {
    process.env.VITE_APP_SURFACE = "android-mock";
    const { default: viteConfig } = await import("../vite.config");

    expect(() =>
      typeof viteConfig === "function"
        ? viteConfig({
            command: "build",
            mode: "preview",
            isPreview: false,
            isSsrBuild: false,
          })
        : viteConfig
    ).not.toThrow();
  });
});
