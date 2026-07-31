// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, describe, expect, it, vi } from "vitest";

describe("config", () => {
  afterEach(() => {
    delete window.__SECPAL_RUNTIME_CONFIG__;
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("prefers the native override over the Web runtime configuration", async () => {
    vi.stubEnv("MODE", "web");
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_URL", "https://build.example.com");
    window.__SECPAL_RUNTIME_CONFIG__ = Object.freeze({
      apiBaseUrl: "https://runtime.example.com",
    });

    const { getApiBaseUrl, setRuntimeApiBaseUrlOverride } =
      await import("./config");

    setRuntimeApiBaseUrlOverride("https://native.example.com/bootstrap");

    expect(getApiBaseUrl()).toBe("https://native.example.com");
  });

  it.each([
    ["standard host", "https://api.example.com"],
    ["explicit port", "https://api.example.com:8443"],
    ["IPv4 host", "https://192.0.2.10"],
    ["IPv6 host", "https://[2001:db8::10]:8443"],
    ["IPv4-mapped public IPv6 host", "https://[::ffff:c000:20a]"],
    ["NAT64 IPv6 host", "https://[64:ff9b::7f00:1]"],
    ["Punycode host", "https://xn--bcher-kva.example"],
  ])(
    "uses a valid %s Web runtime origin before the build fallback",
    async (_name, origin) => {
      vi.stubEnv("MODE", "web");
      vi.stubEnv("PROD", true);
      vi.stubEnv("VITE_API_URL", "https://build.example.com/path");
      window.__SECPAL_RUNTIME_CONFIG__ = Object.freeze({ apiBaseUrl: origin });

      const { getApiBaseUrl } = await import("./config");

      expect(getApiBaseUrl()).toBe(origin);
    }
  );

  it("treats the neutral Web runtime value as no deployment override", async () => {
    vi.stubEnv("MODE", "web");
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_URL", "https://build.example.com/path");
    window.__SECPAL_RUNTIME_CONFIG__ = Object.freeze({ apiBaseUrl: null });

    const { getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("https://build.example.com");
  });

  it("returns the normalized origin for a valid Web runtime value", async () => {
    vi.stubEnv("MODE", "web");
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_URL", "https://build.example.com");
    window.__SECPAL_RUNTIME_CONFIG__ = Object.freeze({
      apiBaseUrl: "https://API.EXAMPLE.COM:443",
    });

    const { getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("https://api.example.com");
  });

  it.each([
    "",
    "http://api.example.com",
    "https://api.example.com/",
    "https://api.example.com/v1",
    "https://user@example.com",
    "https://api.example.com?x=1",
    "https://api.example.com#fragment",
    " https://api.example.com",
    "https://api.example.com\n",
    'https://api.example.com"',
    "https://api.example.com\\",
    "javascript:alert(1)",
    "https://api.example.com:0",
    "https://api.example.com:65536",
  ])("rejects an invalid non-neutral Web runtime value: %s", async (value) => {
    vi.stubEnv("MODE", "web");
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_URL", "https://build.example.com");
    window.__SECPAL_RUNTIME_CONFIG__ = Object.freeze({ apiBaseUrl: value });

    const { getApiBaseUrl } = await import("./config");

    expect(() => getApiBaseUrl()).toThrow(
      "Web runtime API base URL must be an exact HTTPS origin"
    );
  });

  it.each([
    "https://localhost",
    "https://api.localhost",
    "https://127.0.0.1",
    "https://127.255.255.255:8443",
    "https://0.0.0.0",
    "https://2130706433",
    "https://0x7f000001",
    "https://017700000001",
    "https://0x7f.1",
    "https://127.1",
    "https://[::1]",
    "https://[::7f00:1]",
    "https://[::ffff:0:0]",
    "https://[::ffff:7f00:1]",
    "https://[::ffff:7fff:ffff]",
  ])("rejects a loopback Web runtime origin: %s", async (origin) => {
    vi.stubEnv("MODE", "web");
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_URL", "https://build.example.com");
    window.__SECPAL_RUNTIME_CONFIG__ = Object.freeze({ apiBaseUrl: origin });

    const { getApiBaseUrl } = await import("./config");

    expect(() => getApiBaseUrl()).toThrow(
      "Web runtime API base URL must be an exact HTTPS origin"
    );
  });

  it("requires an explicit absolute API URL in production", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "");

    const { resolveApiBaseUrl } = await import("./config");

    expect(() =>
      resolveApiBaseUrl({
        runtimeHostname: "customer.secpal.dev",
      })
    ).toThrow(
      "VITE_API_URL must be set to an absolute https:// or http:// API origin in production"
    );
  });

  it("keeps production API validation active for production web-surface builds", async () => {
    vi.stubEnv("MODE", "web");
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_URL", "");

    const { resolveApiBaseUrl } = await import("./config");

    expect(() =>
      resolveApiBaseUrl({
        runtimeHostname: "customer.secpal.dev",
      })
    ).toThrow(
      "VITE_API_URL must be set to an absolute https:// or http:// API origin in production"
    );
  });

  it("keeps preview-mode loopback API bases relaxed even when Vite marks the bundle as PROD", async () => {
    vi.stubEnv("MODE", "preview");
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_URL", "http://localhost:4173");

    const { buildApiUrl, resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "localhost",
      })
    ).toBe("http://localhost:4173");
    expect(
      buildApiUrl("/v1/me", {
        runtimeHostname: "localhost",
      })
    ).toBe("http://localhost:4173/v1/me");
  });

  it("allows empty API configuration for localhost production audits", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "");

    const { buildApiUrl, resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "localhost",
      })
    ).toBe("");
    expect(
      buildApiUrl("/v1/me", {
        runtimeHostname: "localhost",
      })
    ).toBe("/v1/me");
  });

  it("prefers VITE_API_URL when explicitly configured", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://tenant.secpal.dev");

    const { getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("https://tenant.secpal.dev");
  });

  it("routes API requests through a validated runtime override until it is cleared", async () => {
    vi.stubEnv("MODE", "development");
    vi.stubEnv("VITE_API_URL", "https://configured.secpal.dev");

    const {
      buildApiUrl,
      clearRuntimeApiBaseUrlOverride,
      getApiBaseUrl,
      setRuntimeApiBaseUrlOverride,
    } = await import("./config");

    setRuntimeApiBaseUrlOverride("https://selected.secpal.dev/v1");

    expect(getApiBaseUrl()).toBe("https://selected.secpal.dev");
    expect(buildApiUrl("/v1/auth/login")).toBe(
      "https://selected.secpal.dev/v1/auth/login"
    );

    clearRuntimeApiBaseUrlOverride();

    expect(getApiBaseUrl()).toBe("https://configured.secpal.dev");
  });

  it("rejects insecure runtime API overrides", async () => {
    const { setRuntimeApiBaseUrlOverride } = await import("./config");

    expect(() =>
      setRuntimeApiBaseUrlOverride("http://selected.secpal.dev")
    ).toThrow("Runtime API base URL must use HTTPS");
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

  it("rejects relative API URLs for production Android-surface builds too", async () => {
    vi.stubEnv("MODE", "android");
    vi.stubEnv("PROD", true);
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
    vi.stubEnv("VITE_API_URL", "https://customer-api.secpal.dev");

    const { buildApiUrl, getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("https://customer-api.secpal.dev");
    expect(buildApiUrl("/v1/auth/logout")).toBe(
      "https://customer-api.secpal.dev/v1/auth/logout"
    );
  });

  it("normalizes VITE_API_URL to its origin, stripping accidental path segments", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://customer-api.secpal.dev/api");

    const { buildApiUrl, getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("https://customer-api.secpal.dev");
    expect(buildApiUrl("/v1/me")).toBe("https://customer-api.secpal.dev/v1/me");
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

  it("keeps localhost preview API URLs usable for preview-mode builds even when Vite sets PROD", async () => {
    vi.stubEnv("MODE", "preview");
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_URL", "http://localhost:4173");

    const { buildApiUrl, getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("http://localhost:4173");
    expect(buildApiUrl("/v1/release")).toBe("http://localhost:4173/v1/release");
  });

  it("keeps loopback API URLs usable for analyze-mode builds even when Vite sets PROD", async () => {
    vi.stubEnv("MODE", "analyze");
    vi.stubEnv("PROD", true);
    vi.stubEnv("VITE_API_URL", "http://localhost:4173");

    const { buildApiUrl, getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("http://localhost:4173");
    expect(buildApiUrl("/v1/release")).toBe("http://localhost:4173/v1/release");
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

  it("preserves an explicitly configured different preview API host on frontend preview hosts", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://api-otter.preview.secpal.dev");

    const { buildApiUrl, resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "frontend-grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-otter.preview.secpal.dev");
    expect(
      buildApiUrl("/v1/auth/login", {
        runtimeHostname: "frontend-grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api-otter.preview.secpal.dev/v1/auth/login");
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

  it("preserves an explicitly configured unrelated API origin on generic workspace preview hosts", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://api.secpal.dev");

    const { buildApiUrl, resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api.secpal.dev");
    expect(
      buildApiUrl("/sanctum/csrf-cookie", {
        runtimeHostname: "grumpy-lynx.preview.secpal.dev",
      })
    ).toBe("https://api.secpal.dev/sanctum/csrf-cookie");
  });

  it("uses the Polyscope workspace sibling API when the bundle leaked a loopback base on a preview workspace host", async () => {
    vi.stubEnv("MODE", "preview");
    vi.stubEnv("VITE_API_URL", "http://localhost:4173");

    const { resolveApiBaseUrl, buildApiUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "velvet-zebra.preview.secpal.dev",
      })
    ).toBe("https://api-velvet-zebra.preview.secpal.dev");

    expect(
      buildApiUrl("/sanctum/csrf-cookie", {
        runtimeHostname: "velvet-zebra.preview.secpal.dev",
      })
    ).toBe("https://api-velvet-zebra.preview.secpal.dev/sanctum/csrf-cookie");
  });

  it("uses the Polyscope workspace API in production mode when the runtime host is a preview workspace and VITE_API_URL is loopback", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "http://localhost:4173");

    const { resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "velvet-zebra.preview.secpal.dev",
      })
    ).toBe("https://api-velvet-zebra.preview.secpal.dev");
  });

  it("uses the Polyscope workspace API when production VITE_API_URL is empty on a preview workspace host", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "");

    const { resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "velvet-zebra.preview.secpal.dev",
      })
    ).toBe("https://api-velvet-zebra.preview.secpal.dev");
  });

  it("keeps an explicit non-loopback API base on Polyscope preview workspaces", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv(
      "VITE_API_URL",
      "https://api-velvet-zebra.preview.secpal.dev/custom/path"
    );

    const { resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "velvet-zebra.preview.secpal.dev",
      })
    ).toBe("https://api-velvet-zebra.preview.secpal.dev");
  });

  it("ignores a leaked preview API origin on localhost production audits", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://api-velvet-zebra.preview.secpal.dev");

    const { buildApiUrl, resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "localhost",
      })
    ).toBe("");
    expect(
      buildApiUrl("/v1/me", {
        runtimeHostname: "localhost",
      })
    ).toBe("/v1/me");
  });

  it("keeps an explicit preview API origin on localhost during development", async () => {
    vi.stubEnv("MODE", "development");
    vi.stubEnv("VITE_API_URL", "https://api-velvet-zebra.preview.secpal.dev");

    const { buildApiUrl, resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "localhost",
      })
    ).toBe("https://api-velvet-zebra.preview.secpal.dev");
    expect(
      buildApiUrl("/v1/me", {
        runtimeHostname: "localhost",
      })
    ).toBe("https://api-velvet-zebra.preview.secpal.dev/v1/me");
  });

  it("does not override a different explicit preview API host on a Polyscope workspace app", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://api-other.preview.secpal.dev");

    const { resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "velvet-zebra.preview.secpal.dev",
      })
    ).toBe("https://api-other.preview.secpal.dev");
  });

  it("replaces an API base that mistakenly points at the SPA preview host with the workspace API", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://velvet-zebra.preview.secpal.dev");

    const { resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "velvet-zebra.preview.secpal.dev",
      })
    ).toBe("https://api-velvet-zebra.preview.secpal.dev");
  });

  it("normalizes preview workspace casing before matching the configured API host", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://velvet-zebra.preview.secpal.dev");

    const { resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "Velvet-Zebra.preview.secpal.dev",
      })
    ).toBe("https://api-velvet-zebra.preview.secpal.dev");
  });

  it("uses the Polyscope workspace sibling API when the bundle leaked a loopback base on a prefixed frontend preview host", async () => {
    vi.stubEnv("MODE", "preview");
    vi.stubEnv("VITE_API_URL", "http://localhost:4173");

    const { resolveApiBaseUrl, buildApiUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "frontend-velvet-zebra.preview.secpal.dev",
      })
    ).toBe("https://api-velvet-zebra.preview.secpal.dev");

    expect(
      buildApiUrl("/sanctum/csrf-cookie", {
        runtimeHostname: "frontend-velvet-zebra.preview.secpal.dev",
      })
    ).toBe("https://api-velvet-zebra.preview.secpal.dev/sanctum/csrf-cookie");
  });

  it("uses the Polyscope workspace API when production VITE_API_URL is empty on a prefixed frontend preview host", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "");

    const { resolveApiBaseUrl } = await import("./config");

    expect(
      resolveApiBaseUrl({
        runtimeHostname: "frontend-velvet-zebra.preview.secpal.dev",
      })
    ).toBe("https://api-velvet-zebra.preview.secpal.dev");
  });
});
