// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, describe, expect, it, vi } from "vitest";
import { getNativePasskeyCapabilities } from "./nativePasskeyCapabilities";

const nativeGlobal = globalThis as typeof globalThis & {
  SecPalNativeAuthBridge?: unknown;
};

afterEach(() => {
  vi.useRealTimers();
  delete nativeGlobal.SecPalNativeAuthBridge;
});

describe("getNativePasskeyCapabilities", () => {
  it("rejects a malformed native capability response", async () => {
    nativeGlobal.SecPalNativeAuthBridge = {
      getPasskeyCapabilities: vi.fn().mockResolvedValue({
        reason: "PASSKEY_ANDROID_VERSION_UNSUPPORTED",
      }),
    };

    await expect(getNativePasskeyCapabilities()).rejects.toThrow(
      "Native passkey capability response is invalid"
    );
  });

  it("rejects when the native capability bridge does not settle", async () => {
    vi.useFakeTimers();
    nativeGlobal.SecPalNativeAuthBridge = {
      getPasskeyCapabilities: vi.fn().mockReturnValue(new Promise(() => {})),
    };

    const capabilities = getNativePasskeyCapabilities();
    const rejection = expect(capabilities).rejects.toThrow(
      "Native passkey capability request timed out"
    );

    await vi.runAllTimersAsync();
    await rejection;
  });
});
