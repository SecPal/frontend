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

  it("uses the native Laravel server as the default proxy target when no API base URL is configured", async () => {
    const { buildDevServerProxyConfig } = await import("../vite.config");

    expect(buildDevServerProxyConfig("")).toEqual({
      clientApiBaseUrl: "",
      proxy: {
        "/health": {
          changeOrigin: true,
          secure: false,
          target: "http://localhost:8000",
        },
        "/sanctum": {
          changeOrigin: true,
          secure: false,
          target: "http://localhost:8000",
        },
        "/v1": {
          changeOrigin: true,
          secure: false,
          target: "http://localhost:8000",
        },
      },
    });
  });

  it("keeps the native Laravel proxy defaults when the API base URL env is missing", async () => {
    const { buildDevServerProxyConfig } = await import("../vite.config");

    expect(buildDevServerProxyConfig(undefined)).toEqual(
      buildDevServerProxyConfig("")
    );
  });

  it("removes the production CSP meta from Vite development HTML", async () => {
    const { stripStaticCspForViteDev } = await import("../vite.config");
    const html = `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta
      http-equiv="Content-Security-Policy"
      content="default-src 'self'; style-src 'self'; style-src-elem 'self'"
    />
    <link rel="stylesheet" href="/src/index.css" />
  </head>
</html>`;

    const transformedHtml = stripStaticCspForViteDev(html);

    expect(transformedHtml).not.toContain("Content-Security-Policy");
    expect(transformedHtml).toContain(
      '<link rel="stylesheet" href="/src/index.css" />'
    );
  });

  it("fails fast when the development HTML CSP contract drifts", async () => {
    const { stripStaticCspForViteDev } = await import("../vite.config");
    const cspMeta =
      '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'" />';
    const reorderedCspMeta =
      '<meta content="default-src \'self\'" http-equiv="Content-Security-Policy" />';

    expect(() => stripStaticCspForViteDev("<html></html>")).toThrow(
      "Expected exactly one static Content-Security-Policy meta element, found 0."
    );
    expect(() =>
      stripStaticCspForViteDev(
        `<html><head>${cspMeta}${reorderedCspMeta}</head></html>`
      )
    ).toThrow(
      "Expected exactly one static Content-Security-Policy meta element, found 2."
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

describe("vite test workflow", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([
    { ci: "", environment: "outside CI" },
    { ci: "true", environment: "in CI" },
  ])(
    "uses a bounded thread pool when the full suite runs $environment",
    async ({ ci }) => {
      vi.stubEnv("CI", ci);
      const { default: viteConfig } = await import("../vite.config");
      const config =
        typeof viteConfig === "function"
          ? viteConfig({
              command: "serve",
              mode: "test",
              isPreview: false,
              isSsrBuild: false,
            })
          : viteConfig;

      expect(config.test?.pool).toBe("threads");
      expect(config.test?.maxWorkers).toBe(2);
    }
  );
});
