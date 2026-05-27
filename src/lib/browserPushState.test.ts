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
});
