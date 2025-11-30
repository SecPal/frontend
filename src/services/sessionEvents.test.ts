// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { sessionEvents, isOnline } from "./sessionEvents";

describe("isOnline", () => {
  it("returns true when navigator.onLine is true", () => {
    vi.stubGlobal("navigator", { onLine: true });
    expect(isOnline()).toBe(true);
    vi.unstubAllGlobals();
  });

  it("returns false when navigator.onLine is false", () => {
    vi.stubGlobal("navigator", { onLine: false });
    expect(isOnline()).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe("sessionEvents", () => {
  beforeEach(() => {
    // Clear all listeners between tests
    sessionEvents.reset();
    vi.clearAllMocks();
  });

  describe("on", () => {
    it("registers a callback for an event", () => {
      const callback = vi.fn();

      sessionEvents.on("session:expired", callback);
      sessionEvents.emit("session:expired");

      expect(callback).toHaveBeenCalledTimes(1);
    });

    it("allows multiple callbacks for the same event", () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      sessionEvents.on("session:expired", callback1);
      sessionEvents.on("session:expired", callback2);
      sessionEvents.emit("session:expired");

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    it("returns an unsubscribe function", () => {
      const callback = vi.fn();

      const unsubscribe = sessionEvents.on("session:expired", callback);
      unsubscribe();
      sessionEvents.emit("session:expired");

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe("emit", () => {
    it("does not throw when no listeners are registered", () => {
      expect(() => {
        sessionEvents.emit("session:expired");
      }).not.toThrow();
    });

    it("catches errors in callbacks and continues with others", () => {
      const errorCallback = vi.fn(() => {
        throw new Error("Test error");
      });
      const successCallback = vi.fn();
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {
        // Suppress error output in tests
      });

      sessionEvents.on("session:expired", errorCallback);
      sessionEvents.on("session:expired", successCallback);
      sessionEvents.emit("session:expired");

      expect(errorCallback).toHaveBeenCalled();
      expect(successCallback).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
