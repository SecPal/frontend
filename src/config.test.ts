// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";

describe("config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("requires an explicit absolute API URL in production", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "");

    const { getApiBaseUrl } = await import("./config");

    expect(() => getApiBaseUrl()).toThrow(
      "VITE_API_URL must be set to an absolute https:// or http:// API origin in production"
    );
  });

  it("prefers VITE_API_URL when explicitly configured", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://tenant.secpal.dev");

    const { getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("https://tenant.secpal.dev");
  });

  it("does not allow production auth/API traffic to fall back to relative routing", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "/api");

    const { buildApiUrl, getApiBaseUrl } = await import("./config");

    expect(() => getApiBaseUrl()).toThrow(
      "VITE_API_URL must be an absolute https:// or http:// API origin in production"
    );
    expect(() => buildApiUrl("/v1/me")).toThrow(
      "VITE_API_URL must be an absolute https:// or http:// API origin in production"
    );
  });

  it("rejects loopback API origins in production builds", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "http://localhost:4173");

    const { buildApiUrl, getApiBaseUrl } = await import("./config");

    expect(() => getApiBaseUrl()).toThrow(
      "VITE_API_URL must not point to a loopback or local preview origin in production"
    );
    expect(() => buildApiUrl("/v1/me")).toThrow(
      "VITE_API_URL must not point to a loopback or local preview origin in production"
    );
  });

  it("accepts deployment-specific absolute production API URLs", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://portal.customer.example");

    const { buildApiUrl, getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("https://portal.customer.example");
    expect(buildApiUrl("/v1/auth/logout")).toBe(
      "https://portal.customer.example/v1/auth/logout"
    );
  });

  it("normalizes VITE_API_URL to its origin, stripping accidental path segments", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://api.customer.example/api");

    const { buildApiUrl, getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("https://api.customer.example");
    expect(buildApiUrl("/v1/me")).toBe("https://api.customer.example/v1/me");
  });

  it("falls back to the canonical live API origin on app.secpal.dev when a preview loopback origin leaked into the bundle", async () => {
    vi.stubEnv("MODE", "preview");
    vi.stubEnv("VITE_API_URL", "http://localhost:4173");

    const { buildApiUrl, getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("http://localhost:4173");

    expect(
      buildApiUrl("/v1/me", {
        runtimeHostname: "app.secpal.dev",
      })
    ).toBe("https://api.secpal.dev/v1/me");
  });

  it("falls back to the canonical live API origin on app.secpal.dev when the bundle kept a relative API base", async () => {
    vi.stubEnv("MODE", "preview");
    vi.stubEnv("VITE_API_URL", "/api");

    const { buildApiUrl } = await import("./config");

    expect(
      buildApiUrl("/sanctum/csrf-cookie", {
        runtimeHostname: "app.secpal.dev",
      })
    ).toBe("https://api.secpal.dev/sanctum/csrf-cookie");
  });

  it("falls back to the canonical live API origin on app.secpal.dev when the bundle points at the SPA host", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://app.secpal.dev");

    const { buildApiUrl, getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("https://app.secpal.dev");

    expect(
      buildApiUrl("/v1/me", {
        runtimeHostname: "app.secpal.dev",
      })
    ).toBe("https://api.secpal.dev/v1/me");
  });

  it("resolveApiBaseUrl returns the canonical live origin on app.secpal.dev when a loopback API base leaked into the bundle", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "http://localhost:4173");

    const { resolveApiBaseUrl } = await import("./config");

    expect(resolveApiBaseUrl({ runtimeHostname: "app.secpal.dev" })).toBe(
      "https://api.secpal.dev"
    );
  });

  it("resolveApiBaseUrl returns the canonical live origin on app.secpal.dev when VITE_API_URL is empty", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "");

    const { resolveApiBaseUrl, buildApiUrl } = await import("./config");

    expect(resolveApiBaseUrl({ runtimeHostname: "app.secpal.dev" })).toBe(
      "https://api.secpal.dev"
    );
    expect(
      buildApiUrl("/sanctum/csrf-cookie", {
        runtimeHostname: "app.secpal.dev",
      })
    ).toBe("https://api.secpal.dev/sanctum/csrf-cookie");
  });

  it("falls back to the workspace preview API origin on frontend preview hosts when the bundle kept a loopback API base", async () => {
    vi.stubEnv("MODE", "preview");
    vi.stubEnv("VITE_API_URL", "http://localhost:4173");

    const { buildApiUrl, resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "frontend-grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-grumpy-lynx.preview.secpal.dev");
    expect(
      buildApiUrl("/sanctum/csrf-cookie", {
        runtimeHostname: "frontend-grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-grumpy-lynx.preview.secpal.dev/sanctum/csrf-cookie");
  });

  it("falls back to the workspace preview API origin on frontend preview hosts when VITE_API_URL is empty", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "");

    const { buildApiUrl, resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "frontend-grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-grumpy-lynx.preview.secpal.dev");
    expect(
      buildApiUrl("/v1/auth/login", {
        runtimeHostname: "frontend-grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-grumpy-lynx.preview.secpal.dev/v1/auth/login");
  });

  it("falls back to the current workspace preview API origin on frontend preview hosts when VITE_API_URL points at another absolute preview origin", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://api-otter.preview.secpal.dev");

    const { buildApiUrl, resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "frontend-grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-grumpy-lynx.preview.secpal.dev");
    expect(
      buildApiUrl("/v1/auth/login", {
        runtimeHostname: "frontend-grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-grumpy-lynx.preview.secpal.dev/v1/auth/login");
  });

  it("falls back to the workspace preview API origin on generic workspace preview hosts when the bundle kept a loopback API base", async () => {
    vi.stubEnv("MODE", "preview");
    vi.stubEnv("VITE_API_URL", "http://localhost:4173");

    const { buildApiUrl, resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-grumpy-lynx.preview.secpal.dev");
    expect(
      buildApiUrl("/sanctum/csrf-cookie", {
        runtimeHostname: "grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-grumpy-lynx.preview.secpal.dev/sanctum/csrf-cookie");
  });

  it("falls back to the workspace preview API origin on generic workspace preview hosts when VITE_API_URL is empty", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "");

    const { buildApiUrl, resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-grumpy-lynx.preview.secpal.dev");
    expect(
      buildApiUrl("/v1/auth/login", {
        runtimeHostname: "grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-grumpy-lynx.preview.secpal.dev/v1/auth/login");
  });

  it("falls back to the current workspace preview API origin on generic workspace preview hosts when VITE_API_URL points at an unrelated absolute API origin", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://api.secpal.dev");

    const { buildApiUrl, resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-grumpy-lynx.preview.secpal.dev");
    expect(
      buildApiUrl("/sanctum/csrf-cookie", {
        runtimeHostname: "grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-grumpy-lynx.preview.secpal.dev/sanctum/csrf-cookie");
  });
});
