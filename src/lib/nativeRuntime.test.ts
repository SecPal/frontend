// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  disableBrowserPwaStateForNativeRuntime,
  isCapacitorNativeRuntime,
  shouldReloadAfterNativePwaCleanup,
} from "./nativeRuntime";

interface MockServiceWorkerRegistration {
  unregister: ReturnType<typeof vi.fn>;
}

function setCapacitorRuntime(value: unknown): void {
  Object.defineProperty(globalThis, "Capacitor", {
    configurable: true,
    value,
  });
}

function clearCapacitorRuntime(): void {
  delete (globalThis as Record<string, unknown>).Capacitor;
}

function setServiceWorker(
  registrations: MockServiceWorkerRegistration[],
  controller: object | null = null
): void {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      controller,
      getRegistrations: vi.fn().mockResolvedValue(registrations),
    },
  });
}

function clearServiceWorker(): void {
  delete (navigator as unknown as Record<string, unknown>).serviceWorker;
}

describe("nativeRuntime", () => {
  beforeEach(() => {
    clearCapacitorRuntime();
    clearServiceWorker();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    clearCapacitorRuntime();
    clearServiceWorker();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  describe("isCapacitorNativeRuntime", () => {
    it("returns false when Capacitor is unavailable", () => {
      expect(isCapacitorNativeRuntime()).toBe(false);
    });

    it("uses Capacitor.isNativePlatform when available", () => {
      setCapacitorRuntime({
        isNativePlatform: () => true,
      });

      expect(isCapacitorNativeRuntime()).toBe(true);
    });

    it("falls back to Capacitor.getPlatform when needed", () => {
      setCapacitorRuntime({
        getPlatform: () => "android",
      });

      expect(isCapacitorNativeRuntime()).toBe(true);
    });
  });

  describe("disableBrowserPwaStateForNativeRuntime", () => {
    it("does nothing outside a native runtime", async () => {
      const unregister = vi.fn().mockResolvedValue(true);
      setServiceWorker([{ unregister }]);

      await expect(disableBrowserPwaStateForNativeRuntime()).resolves.toBe(
        false
      );
      expect(unregister).not.toHaveBeenCalled();
    });

    it("unregisters service workers and clears cache storage in native runtime", async () => {
      const unregister = vi.fn().mockResolvedValue(true);
      const cacheDelete = vi.fn().mockResolvedValue(true);
      const cacheKeys = vi.fn().mockResolvedValue(["shell-cache"]);

      setCapacitorRuntime({
        isNativePlatform: () => true,
      });
      setServiceWorker([{ unregister }], { active: true });
      vi.stubGlobal("caches", {
        keys: cacheKeys,
        delete: cacheDelete,
      });

      await expect(disableBrowserPwaStateForNativeRuntime()).resolves.toBe(
        true
      );
      expect(unregister).toHaveBeenCalledTimes(1);
      expect(cacheKeys).toHaveBeenCalledTimes(1);
      expect(cacheDelete).toHaveBeenCalledWith("shell-cache");
    });

    it("returns controller state even when Cache Storage is unavailable", async () => {
      const unregister = vi.fn().mockResolvedValue(true);

      setCapacitorRuntime({
        isNativePlatform: () => true,
      });
      setServiceWorker([{ unregister }], { active: true });
      vi.unstubAllGlobals();

      await expect(disableBrowserPwaStateForNativeRuntime()).resolves.toBe(
        true
      );
      expect(unregister).toHaveBeenCalledTimes(1);
    });
  });

  describe("shouldReloadAfterNativePwaCleanup", () => {
    it("reloads only once per cleanup cycle", () => {
      expect(shouldReloadAfterNativePwaCleanup()).toBe(true);
      expect(shouldReloadAfterNativePwaCleanup()).toBe(false);
      expect(shouldReloadAfterNativePwaCleanup()).toBe(true);
    });
  });
});
