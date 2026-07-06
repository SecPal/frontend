// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import path from "node:path";
import { readFileSync } from "node:fs";
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

describe("theme-color bootstrap stale asset recovery", () => {
  it("skips reload when it cannot persist the one-shot recovery latch", async () => {
    document.head.innerHTML = "";
    document.body.innerHTML = "";

    const testWindow = globalThis as ThemeColorTestWindow;
    testWindow.__themeColorReload = vi.fn();
    const getRegistrations = vi
      .fn()
      .mockResolvedValue([{ unregister: vi.fn().mockResolvedValue(true) }]);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        getRegistrations,
      },
    });
    const cacheKeys = vi.fn().mockResolvedValue(["html-shell"]);
    Object.defineProperty(window, "caches", {
      configurable: true,
      value: {
        keys: cacheKeys,
        delete: vi.fn().mockResolvedValue(true),
      },
    });
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

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(getRegistrations).not.toHaveBeenCalled();
    expect(cacheKeys).not.toHaveBeenCalled();
    expect(testWindow.__themeColorReload).not.toHaveBeenCalled();
  });
});
