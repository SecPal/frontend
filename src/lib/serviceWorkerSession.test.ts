// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { syncOfflineSessionAccess } from "./serviceWorkerSession";
import { writeOfflineSessionState } from "./offlineSessionState";

vi.mock("./offlineSessionState", () => ({
  writeOfflineSessionState: vi
    .fn<() => Promise<void>>()
    .mockResolvedValue(undefined),
}));

const mockWriteOfflineSessionState = vi.mocked(writeOfflineSessionState);

function defineServiceWorker(value: unknown): void {
  Object.defineProperty(navigator, "serviceWorker", {
    value,
    writable: true,
    configurable: true,
  });
}

function removeServiceWorker(): void {
  delete (navigator as unknown as Record<string, unknown>).serviceWorker;
}

describe("syncOfflineSessionAccess", () => {
  beforeEach(() => {
    mockWriteOfflineSessionState.mockResolvedValue(undefined);
  });

  afterEach(() => {
    removeServiceWorker();
  });

  it("always writes the offline session state regardless of SW availability", async () => {
    await syncOfflineSessionAccess(true);
    expect(mockWriteOfflineSessionState).toHaveBeenCalledWith(true);

    await syncOfflineSessionAccess(false);
    expect(mockWriteOfflineSessionState).toHaveBeenCalledWith(false);
  });

  it("resolves without error when serviceWorker API is unavailable (jsdom default)", async () => {
    // In jsdom, navigator.serviceWorker is undefined → exercises the early-return path.
    removeServiceWorker();
    await expect(syncOfflineSessionAccess(true)).resolves.toBeUndefined();
    expect(mockWriteOfflineSessionState).toHaveBeenCalledWith(true);
  });

  describe("when ServiceWorker API is available", () => {
    const mockPostMessage = vi.fn<() => void>();

    beforeEach(() => {
      mockPostMessage.mockClear();
    });

    it("posts AUTH_SESSION_CHANGED to the controller when available", async () => {
      const mockController = { postMessage: mockPostMessage };
      defineServiceWorker({
        controller: mockController,
        ready: Promise.resolve({
          active: null,
          waiting: null,
          installing: null,
        }),
      });

      await syncOfflineSessionAccess(true);

      expect(mockPostMessage).toHaveBeenCalledWith({
        type: "AUTH_SESSION_CHANGED",
        isAuthenticated: true,
      });
    });

    it("posts AUTH_SESSION_CHANGED with isAuthenticated=false on logout", async () => {
      const mockController = { postMessage: mockPostMessage };
      defineServiceWorker({
        controller: mockController,
        ready: Promise.resolve({
          active: null,
          waiting: null,
          installing: null,
        }),
      });

      await syncOfflineSessionAccess(false);

      expect(mockPostMessage).toHaveBeenCalledWith({
        type: "AUTH_SESSION_CHANGED",
        isAuthenticated: false,
      });
    });

    it("falls back to active worker when controller is null", async () => {
      const mockActive = { postMessage: mockPostMessage };
      defineServiceWorker({
        controller: null,
        ready: Promise.resolve({
          active: mockActive,
          waiting: null,
          installing: null,
        }),
      });

      await syncOfflineSessionAccess(true);

      expect(mockPostMessage).toHaveBeenCalledWith({
        type: "AUTH_SESSION_CHANGED",
        isAuthenticated: true,
      });
    });

    it("falls back to waiting worker when controller and active are null", async () => {
      const mockWaiting = { postMessage: mockPostMessage };
      defineServiceWorker({
        controller: null,
        ready: Promise.resolve({
          active: null,
          waiting: mockWaiting,
          installing: null,
        }),
      });

      await syncOfflineSessionAccess(true);

      expect(mockPostMessage).toHaveBeenCalledWith({
        type: "AUTH_SESSION_CHANGED",
        isAuthenticated: true,
      });
    });

    it("falls back to installing worker when controller, active, and waiting are null", async () => {
      const mockInstalling = { postMessage: mockPostMessage };
      defineServiceWorker({
        controller: null,
        ready: Promise.resolve({
          active: null,
          waiting: null,
          installing: mockInstalling,
        }),
      });

      await syncOfflineSessionAccess(true);

      expect(mockPostMessage).toHaveBeenCalledWith({
        type: "AUTH_SESSION_CHANGED",
        isAuthenticated: true,
      });
    });

    it("resolves silently when all SW targets are null", async () => {
      defineServiceWorker({
        controller: null,
        ready: Promise.resolve({
          active: null,
          waiting: null,
          installing: null,
        }),
      });

      await expect(syncOfflineSessionAccess(true)).resolves.toBeUndefined();
    });

    it("warns but does not throw when navigator.serviceWorker.ready rejects", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      defineServiceWorker({
        controller: null,
        ready: Promise.reject(new Error("SW registration failed")),
      });

      await expect(syncOfflineSessionAccess(true)).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalled();
    });
  });
});
