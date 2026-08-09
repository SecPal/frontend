// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import { awaitAbortable } from "./abortablePromise";

function createLegacyWebViewAbortController(): AbortController {
  const controller = new AbortController();

  Object.defineProperties(controller.signal, {
    reason: {
      configurable: true,
      value: undefined,
    },
    throwIfAborted: {
      configurable: true,
      value: undefined,
    },
  });

  return controller;
}

describe("awaitAbortable", () => {
  it("supports an un-aborted legacy WebView signal", async () => {
    const controller = createLegacyWebViewAbortController();

    await expect(
      awaitAbortable(Promise.resolve("completed"), controller.signal)
    ).resolves.toBe("completed");
  });

  it("uses an AbortError when a legacy WebView signal has no reason", async () => {
    const controller = createLegacyWebViewAbortController();
    const operation = new Promise<never>(() => undefined);
    const result = awaitAbortable(operation, controller.signal);

    controller.abort();

    await expect(result).rejects.toMatchObject({ name: "AbortError" });
  });
});
