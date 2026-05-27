// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearBrowserPushInstallationId,
  getOrCreateBrowserPushInstallationId,
  peekBrowserPushInstallationId,
} from "./browserPushState";

describe("browserPushState", () => {
  beforeEach(() => {
    clearBrowserPushInstallationId();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    clearBrowserPushInstallationId();
    localStorage.clear();
  });

  it("reuses the volatile installation id when localStorage writes fail", () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });

    const installationId = getOrCreateBrowserPushInstallationId();

    setItemSpy.mockRestore();

    expect(peekBrowserPushInstallationId()).toBe(installationId);
    expect(getOrCreateBrowserPushInstallationId()).toBe(installationId);
  });

  it("uses crypto.getRandomValues when randomUUID is unavailable", () => {
    const getRandomValues = vi.fn((buffer: Uint8Array) => {
      buffer.set([
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b,
        0x0c, 0x0d, 0x0e, 0x0f,
      ]);

      return buffer;
    });

    vi.stubGlobal("crypto", {
      getRandomValues,
    });

    const installationId = getOrCreateBrowserPushInstallationId();

    expect(getRandomValues).toHaveBeenCalledTimes(1);
    expect(installationId).toBe(
      "browser-push-000102030405060708090a0b0c0d0e0f"
    );
  });
});
