// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  OFFLINE_SESSION_CACHE_NAME,
  readOfflineSessionState,
} from "./offlineSessionState";
import { syncOfflineSessionAccess } from "./serviceWorkerSession";

function toCacheKey(request: RequestInfo | URL): string {
  if (request instanceof Request) {
    return request.url;
  }

  if (request instanceof URL) {
    return request.toString();
  }

  return String(request);
}

describe("syncOfflineSessionAccess", () => {
  const cacheStore = new Map<string, Response>();
  const controller = {
    postMessage: vi.fn(),
  };
  const activeWorker = {
    postMessage: vi.fn(),
  };
  const mockCache = {
    put: vi.fn(async (request: RequestInfo | URL, response: Response) => {
      cacheStore.set(toCacheKey(request), response.clone());
    }),
    match: vi.fn(async (request: RequestInfo | URL) => {
      return cacheStore.get(toCacheKey(request))?.clone();
    }),
    delete: vi.fn(async (request: RequestInfo | URL) => {
      return cacheStore.delete(toCacheKey(request));
    }),
  };
  const mockCaches = {
    open: vi.fn(async () => mockCache),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    cacheStore.clear();

    Object.defineProperty(globalThis, "caches", {
      configurable: true,
      value: mockCaches,
    });

    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: {
        controller,
        ready: Promise.resolve({
          active: activeWorker,
          waiting: null,
          installing: null,
        }),
      },
    });
  });

  it("persists explicit logged-out session state and notifies the service worker", async () => {
    await syncOfflineSessionAccess(false);

    expect(mockCaches.open).toHaveBeenCalledWith(OFFLINE_SESSION_CACHE_NAME);
    expect(await readOfflineSessionState()).toEqual({
      isAuthenticated: false,
      updatedAt: expect.any(Number),
    });
    expect(controller.postMessage).toHaveBeenCalledWith({
      type: "AUTH_SESSION_CHANGED",
      isAuthenticated: false,
    });
  });

  it("does not fail when service worker support is unavailable", async () => {
    Object.defineProperty(window.navigator, "serviceWorker", {
      configurable: true,
      value: undefined,
    });

    await expect(syncOfflineSessionAccess(true)).resolves.not.toThrow();
    expect(await readOfflineSessionState()).toEqual({
      isAuthenticated: true,
      updatedAt: expect.any(Number),
    });
  });
});
