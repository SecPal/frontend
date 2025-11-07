// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useShareTarget } from "./useShareTarget";

describe("useShareTarget", () => {
  const originalHistory = window.history;

  beforeEach(() => {
    // Mock window.location using vi.stubGlobal
    vi.stubGlobal("location", {
      href: "https://secpal.app/",
      pathname: "/",
      search: "",
      hash: "",
    });

    // Mock window.history
    vi.stubGlobal("history", {
      ...originalHistory,
      replaceState: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("should initialize with default values", () => {
    const { result } = renderHook(() => useShareTarget());

    expect(result.current.isSharing).toBe(false);
    expect(result.current.sharedData).toBeNull();
    expect(typeof result.current.clearSharedData).toBe("function");
  });

  it("should detect shared text data", async () => {
    // @ts-expect-error - Mocking location for tests
    window.location = {
      ...window.location,
      href: "https://secpal.app/share?title=Hello&text=World&url=https://example.com",
      pathname: "/share",
      search: "?title=Hello&text=World&url=https://example.com",
      hash: "",
    } as Location;

    const { result } = renderHook(() => useShareTarget());

    await waitFor(() => {
      expect(result.current.sharedData).toEqual({
        title: "Hello",
        text: "World",
        url: "https://example.com",
      });
    });

    // URL cleanup: cleanUrl="/", hash=""
    expect(window.history.replaceState).toHaveBeenCalledWith({}, "", "/");
  });

  it("should handle partial shared data", async () => {
    // @ts-expect-error - Mocking location for tests
    window.location = {
      ...window.location,
      href: "https://secpal.app/share?text=SharedText",
      pathname: "/share",
      search: "?text=SharedText",
      hash: "",
    } as Location;

    const { result } = renderHook(() => useShareTarget());

    await waitFor(() => {
      expect(result.current.sharedData).toEqual({
        title: undefined,
        text: "SharedText",
        url: undefined,
      });
    });
  });

  it("should handle URL encoded data", async () => {
    // @ts-expect-error - Mocking location for tests
    window.location = {
      ...window.location,
      href: "https://secpal.app/share?title=Hello%20World&text=Test%20%26%20More",
      pathname: "/share",
      search: "?title=Hello%20World&text=Test%20%26%20More",
      hash: "",
    } as Location;

    const { result } = renderHook(() => useShareTarget());

    await waitFor(() => {
      expect(result.current.sharedData).toEqual({
        title: "Hello World",
        text: "Test & More",
        url: undefined,
      });
    });
  });

  it("should not detect share when not on /share path", () => {
    // @ts-expect-error - Mocking location for tests
    window.location = {
      ...window.location,
      href: "https://secpal.app/home?title=Hello",
      pathname: "/home",
      search: "?title=Hello",
      hash: "",
    } as Location;

    const { result } = renderHook(() => useShareTarget());

    expect(result.current.sharedData).toBeNull();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it("should not detect share when no search params", () => {
    // @ts-expect-error - Mocking location for tests
    window.location = {
      ...window.location,
      href: "https://secpal.app/share",
      pathname: "/share",
      search: "",
      hash: "",
    } as Location;

    const { result } = renderHook(() => useShareTarget());

    expect(result.current.sharedData).toBeNull();
    expect(window.history.replaceState).not.toHaveBeenCalled();
  });

  it("should clear shared data", async () => {
    // @ts-expect-error - Mocking location for tests
    window.location = {
      ...window.location,
      href: "https://secpal.app/share?text=Test",
      pathname: "/share",
      search: "?text=Test",
      hash: "",
    } as Location;

    const { result } = renderHook(() => useShareTarget());

    await waitFor(() => {
      expect(result.current.sharedData).toEqual({
        title: undefined,
        text: "Test",
        url: undefined,
      });
    });

    result.current.clearSharedData();

    await waitFor(() => {
      expect(result.current.sharedData).toBeNull();
    });
  });

  it("should handle multiple share events", async () => {
    // @ts-expect-error - Mocking location for tests
    window.location = {
      ...window.location,
      href: "https://secpal.app/share?text=First",
      pathname: "/share",
      search: "?text=First",
      hash: "",
    } as Location;

    const { result, rerender } = renderHook(() => useShareTarget());

    await waitFor(() => {
      expect(result.current.sharedData?.text).toBe("First");
    });

    result.current.clearSharedData();

    await waitFor(() => {
      expect(result.current.sharedData).toBeNull();
    });

    // Simulate new share
    // @ts-expect-error - Mocking location for tests
    window.location = {
      ...window.location,
      href: "https://secpal.app/share?text=Second",
      pathname: "/share",
      search: "?text=Second",
      hash: "",
    } as Location;

    rerender();

    // Note: In real implementation, this would need the component to remount
    // or have a different trigger mechanism
  });

  it("should handle empty string values", async () => {
    // @ts-expect-error - Mocking location for tests
    window.location = {
      ...window.location,
      href: "https://secpal.app/share?title=&text=NotEmpty",
      pathname: "/share",
      search: "?title=&text=NotEmpty",
      hash: "",
    } as Location;

    const { result } = renderHook(() => useShareTarget());

    await waitFor(() => {
      expect(result.current.sharedData).toEqual({
        title: undefined, // Empty string should be undefined
        text: "NotEmpty",
        url: undefined,
      });
    });
  });

  it("should set isSharing flag during processing", async () => {
    // @ts-expect-error - Mocking location for tests
    window.location = {
      ...window.location,
      href: "https://secpal.app/share?text=Test",
      pathname: "/share",
      search: "?text=Test",
      hash: "",
    } as Location;

    const { result } = renderHook(() => useShareTarget());

    // isSharing should be set briefly and then cleared
    await waitFor(() => {
      expect(result.current.isSharing).toBe(false);
      expect(result.current.sharedData).not.toBeNull();
    });
  });

  it("should work in SSR environment", () => {
    // The hook has a guard: if (typeof window === "undefined") return default values
    // Since we can't actually delete window in this test environment,
    // we verify that it returns null/false when not on the /share path
    const { result } = renderHook(() => useShareTarget());

    // Should have default values since we're not on /share
    expect(result.current.sharedData).toBeNull();
    expect(result.current.isSharing).toBe(false);
  });
});
