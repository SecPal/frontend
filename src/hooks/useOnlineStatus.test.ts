// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useOnlineStatus } from "./useOnlineStatus";

describe("useOnlineStatus", () => {
  beforeEach(() => {
    // Reset navigator.onLine to true before each test
    Object.defineProperty(navigator, "onLine", {
      writable: true,
      value: true,
    });
  });

  it("should return true when online", () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);
  });

  it("should update to false when going offline", () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });

    expect(result.current).toBe(false);
  });

  it("should update to true when going back online", () => {
    const { result } = renderHook(() => useOnlineStatus());

    act(() => {
      window.dispatchEvent(new Event("offline"));
    });
    expect(result.current).toBe(false);

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    expect(result.current).toBe(true);
  });

  it("should cleanup event listeners on unmount", () => {
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    const { unmount } = renderHook(() => useOnlineStatus());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "online",
      expect.any(Function)
    );
    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      "offline",
      expect.any(Function)
    );
  });
});
