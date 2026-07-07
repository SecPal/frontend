// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, describe, expect, it, vi } from "vitest";

const capacitorRuntime = vi.hoisted(() => ({
  getPlatform: vi.fn(),
  isNativePlatform: vi.fn(),
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: capacitorRuntime,
}));

describe("platform runtime", () => {
  afterEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("exposes web runtime flags from Capacitor", async () => {
    capacitorRuntime.getPlatform.mockReturnValue("web");
    capacitorRuntime.isNativePlatform.mockReturnValue(false);

    const runtime = await import("./runtime");

    expect(runtime.runtimePlatform).toBe("web");
    expect(runtime.isNativeRuntime).toBe(false);
    expect(runtime.isWebRuntime).toBe(true);
    expect(runtime.isAndroidRuntime).toBe(false);
    expect(runtime.isIosRuntime).toBe(false);
  });

  it("exposes Android native runtime flags from Capacitor", async () => {
    capacitorRuntime.getPlatform.mockReturnValue("android");
    capacitorRuntime.isNativePlatform.mockReturnValue(true);

    const runtime = await import("./runtime");

    expect(runtime.runtimePlatform).toBe("android");
    expect(runtime.isNativeRuntime).toBe(true);
    expect(runtime.isWebRuntime).toBe(false);
    expect(runtime.isAndroidRuntime).toBe(true);
    expect(runtime.isIosRuntime).toBe(false);
  });

  it("exposes iOS native runtime flags from Capacitor", async () => {
    capacitorRuntime.getPlatform.mockReturnValue("ios");
    capacitorRuntime.isNativePlatform.mockReturnValue(true);

    const runtime = await import("./runtime");

    expect(runtime.runtimePlatform).toBe("ios");
    expect(runtime.isNativeRuntime).toBe(true);
    expect(runtime.isWebRuntime).toBe(false);
    expect(runtime.isAndroidRuntime).toBe(false);
    expect(runtime.isIosRuntime).toBe(true);
  });
});
