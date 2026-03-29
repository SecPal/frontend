// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, expect, it, vi } from "vitest";

describe("config", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("uses secpal.dev as the production API fallback", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "");

    const { getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("https://api.secpal.dev");
  });

  it("prefers VITE_API_URL when explicitly configured", async () => {
    vi.stubEnv("MODE", "production");
    vi.stubEnv("VITE_API_URL", "https://tenant.secpal.dev");

    const { getApiBaseUrl } = await import("./config");

    expect(getApiBaseUrl()).toBe("https://tenant.secpal.dev");
  });
});
