// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const themeColorBootstrapSource = readFileSync(
  path.join(repoRoot, "public/theme-color.js"),
  "utf8"
);
const instrumentedThemeColorBootstrapSource = themeColorBootstrapSource
  .replace("window.location.reload();", "globalThis.__themeColorReload();")
  .replace(
    "})();",
    [
      "globalThis.__themeColorTestHooks = { recoverFromStaleHashedAsset };",
      "})();",
    ].join("\n")
  );

interface ThemeColorTestWindow extends Window {
  __themeColorReload: ReturnType<typeof vi.fn>;
  __themeColorTestHooks?: {
    recoverFromStaleHashedAsset: () => void;
  };
}

function createDeferredPromise() {
  let resolve: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve: resolve! };
}

function installRecoveryEnvironment() {
  document.head.innerHTML = "";
  document.body.innerHTML = "";

  const testWindow = globalThis as ThemeColorTestWindow;
  testWindow.__themeColorReload = vi.fn();
  const unregister = vi.fn().mockResolvedValue(true);
  const getRegistrations = vi.fn().mockResolvedValue([{ unregister }]);
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistrations,
    },
  });
  const cacheDelete = vi.fn().mockResolvedValue(true);
  const cacheKeys = vi.fn().mockResolvedValue(["html-shell"]);
  Object.defineProperty(window, "caches", {
    configurable: true,
    value: {
      keys: cacheKeys,
      delete: cacheDelete,
    },
  });

  return { cacheDelete, cacheKeys, getRegistrations, testWindow, unregister };
}

async function waitForRecoveryTasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => window.setTimeout(resolve, 0));
}

describe("theme-color bootstrap stale asset recovery", () => {
  it("recovers when an early same-origin built asset preload fails", async () => {
    const { cacheDelete, cacheKeys, getRegistrations, testWindow, unregister } =
      installRecoveryEnvironment();
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
    new Function(instrumentedThemeColorBootstrapSource)();

    const preload = document.createElement("link");
    preload.rel = "modulepreload";
    preload.href = "/assets/index-stale.js";
    document.head.append(preload);
    preload.dispatchEvent(new Event("error"));

    await waitForRecoveryTasks();

    expect(getRegistrations).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledOnce();
    expect(cacheKeys).toHaveBeenCalledOnce();
    expect(cacheDelete).toHaveBeenCalledWith("html-shell");
    expect(testWindow.__themeColorReload).toHaveBeenCalledOnce();
  });

  it("skips reload when it cannot persist the one-shot recovery latch", async () => {
    const { cacheKeys, getRegistrations, testWindow } =
      installRecoveryEnvironment();
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem: vi.fn(() => {
          throw new Error("sessionStorage unavailable");
        }),
        removeItem: vi.fn(),
        clear: vi.fn(),
      },
    });
    new Function(instrumentedThemeColorBootstrapSource)();

    expect(testWindow.__themeColorTestHooks).toBeDefined();
    testWindow.__themeColorTestHooks?.recoverFromStaleHashedAsset();

    await waitForRecoveryTasks();

    expect(getRegistrations).not.toHaveBeenCalled();
    expect(cacheKeys).not.toHaveBeenCalled();
    expect(testWindow.__themeColorReload).not.toHaveBeenCalled();
  });

  it("keeps the recovery latch until the next page boots", async () => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";

    const testWindow = globalThis as ThemeColorTestWindow;
    testWindow.__themeColorReload = vi.fn();
    const unregisterDeferred = createDeferredPromise();
    const cacheDeferred = createDeferredPromise();
    const unregister = vi.fn().mockReturnValue(unregisterDeferred.promise);
    const getRegistrations = vi.fn().mockResolvedValue([{ unregister }]);
    const removeItem = vi.fn();
    const setItem = vi.fn();

    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations,
      },
    });
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: {
        keys: vi.fn().mockReturnValue(cacheDeferred.promise.then(() => [])),
        delete: vi.fn().mockResolvedValue(true),
      },
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: {
        getItem: vi.fn().mockReturnValue(null),
        setItem,
        removeItem,
        clear: vi.fn(),
      },
    });

    new Function(instrumentedThemeColorBootstrapSource)();

    testWindow.__themeColorTestHooks?.recoverFromStaleHashedAsset();
    window.dispatchEvent(new Event("app-bootstrap-ready"));

    expect(setItem).toHaveBeenCalledWith(
      "secpal.asset-load-recovery",
      "pending"
    );
    expect(removeItem).not.toHaveBeenCalled();
    expect(testWindow.__themeColorReload).not.toHaveBeenCalled();

    unregisterDeferred.resolve();
    cacheDeferred.resolve();
    await waitForRecoveryTasks();

    expect(testWindow.__themeColorReload).toHaveBeenCalledOnce();
  });
});
