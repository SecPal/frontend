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

  it("accepts deployment-specific absolute production API URLs", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://portal.customer.example");

    const { buildApiUrl, getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("https://portal.customer.example");
    expect(buildApiUrl("/v1/auth/logout")).toBe(
      "https://portal.customer.example/v1/auth/logout"
    );
  });
});
