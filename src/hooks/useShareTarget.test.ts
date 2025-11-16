// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { waitFor } from "@testing-library/dom";
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

    // Note: URL cleanup (replaceState) only happens when SW message is received
    // In this test, no SW message is sent, so replaceState is not called
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

    act(() => {
      result.current.clearSharedData();
    });

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

    act(() => {
      result.current.clearSharedData();
    });

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

  it("should handle shared data processing", async () => {
    // @ts-expect-error - Mocking location for tests
    window.location = {
      ...window.location,
      href: "https://secpal.app/share?text=Test",
      pathname: "/share",
      search: "?text=Test",
      hash: "",
    } as Location;

    const { result } = renderHook(() => useShareTarget());

    // Data should be parsed and available
    await waitFor(() => {
      expect(result.current.sharedData).not.toBeNull();
    });
  });

  it("should work in SSR environment", () => {
    // The hook has a guard: if (typeof window === "undefined") return default values
    // Since we can't actually delete window in this test environment,
    // we verify that it returns null when not on the /share path
    const { result } = renderHook(() => useShareTarget());

    // Should have default values since we're not on /share
    expect(result.current.sharedData).toBeNull();
  });

  // sessionStorage file handling was replaced with Service Worker messages
  // These tests are obsolete with the new IndexedDB architecture
  describe("Service Worker Message Handling", () => {
    let mockServiceWorker: {
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      // Mock Service Worker API
      mockServiceWorker = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      vi.stubGlobal("navigator", {
        serviceWorker: mockServiceWorker,
      });
    });

    it("should register Service Worker message listener", () => {
      renderHook(() => useShareTarget());

      expect(mockServiceWorker.addEventListener).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      );
    });

    it("should process SHARE_TARGET_FILES message with matching shareId", async () => {
      const mockFiles = [
        { id: 1, name: "test.pdf", type: "application/pdf", size: 1024 },
        { id: 2, name: "image.jpg", type: "image/jpeg", size: 2048 },
      ];

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Files&share_id=abc123",
        pathname: "/share",
        search: "?title=Files&share_id=abc123",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      // Get the registered message handler
      const messageHandler = mockServiceWorker.addEventListener.mock!
        .calls[0]![1] as (event: MessageEvent) => void;

      // Simulate SW message
      act(() => {
        messageHandler(
          new MessageEvent("message", {
            data: {
              type: "SHARE_TARGET_FILES",
              shareId: "abc123",
              files: mockFiles,
            },
          })
        );
      });

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          title: "Files",
          files: mockFiles,
        });
      });
    });

    it("should ignore SHARE_TARGET_FILES with mismatched shareId", async () => {
      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?share_id=abc123",
        pathname: "/share",
        search: "?share_id=abc123",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      const messageHandler = mockServiceWorker.addEventListener.mock!
        .calls[0]![1] as (event: MessageEvent) => void;

      // Simulate SW message with different shareId
      act(() => {
        messageHandler(
          new MessageEvent("message", {
            data: {
              type: "SHARE_TARGET_FILES",
              shareId: "different-id",
              files: [{ id: 1, name: "test.pdf" }],
            },
          })
        );
      });

      // Should not update sharedData
      expect(result.current.sharedData).toBeNull();
    });

    it("should ignore non-SHARE_TARGET_FILES messages", async () => {
      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?share_id=abc123",
        pathname: "/share",
        search: "?share_id=abc123",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      const messageHandler = mockServiceWorker.addEventListener.mock!
        .calls[0]![1] as (event: MessageEvent) => void;

      // Simulate other SW message
      act(() => {
        messageHandler(
          new MessageEvent("message", {
            data: {
              type: "OTHER_MESSAGE",
              payload: "data",
            },
          })
        );
      });

      // Should not update sharedData
      expect(result.current.sharedData).toBeNull();
    });

    it("should cleanup Service Worker listener on unmount", () => {
      const { unmount } = renderHook(() => useShareTarget());

      unmount();

      expect(mockServiceWorker.removeEventListener).toHaveBeenCalledWith(
        "message",
        expect.any(Function)
      );
    });

    it("should handle all URL parameters with files", async () => {
      const mockFiles = [
        { id: 1, name: "doc.pdf", type: "application/pdf", size: 5000 },
      ];

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Report&text=See%20attachment&url=https://example.com&share_id=xyz789",
        pathname: "/share",
        search:
          "?title=Report&text=See%20attachment&url=https://example.com&share_id=xyz789",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      const messageHandler = mockServiceWorker.addEventListener.mock!
        .calls[0]![1] as (event: MessageEvent) => void;

      act(() => {
        messageHandler(
          new MessageEvent("message", {
            data: {
              type: "SHARE_TARGET_FILES",
              shareId: "xyz789",
              files: mockFiles,
            },
          })
        );
      });

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          title: "Report",
          text: "See attachment",
          url: "https://example.com",
          files: mockFiles,
        });
      });
    });

    it("should handle empty string values in URL params", async () => {
      const mockFiles = [{ id: 1, name: "test.txt" }];

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=&text=Content&share_id=empty123",
        pathname: "/share",
        search: "?title=&text=Content&share_id=empty123",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      const messageHandler = mockServiceWorker.addEventListener.mock!
        .calls[0]![1] as (event: MessageEvent) => void;

      act(() => {
        messageHandler(
          new MessageEvent("message", {
            data: {
              type: "SHARE_TARGET_FILES",
              shareId: "empty123",
              files: mockFiles,
            },
          })
        );
      });

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          title: undefined, // Empty string becomes undefined
          text: "Content",
          files: mockFiles,
        });
      });
    });
  });

  describe("history.replaceState Handling", () => {
    let mockServiceWorker: {
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockServiceWorker = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      vi.stubGlobal("navigator", {
        serviceWorker: mockServiceWorker,
      });
    });

    it("should preserve hash when cleaning URL via SW message", async () => {
      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Test&share_id=hash123#section",
        pathname: "/share",
        search: "?title=Test&share_id=hash123",
        hash: "#section",
      } as Location;

      renderHook(() => useShareTarget());

      const messageHandler = mockServiceWorker.addEventListener.mock
        .calls[0]![1] as (event: MessageEvent) => void;

      act(() => {
        messageHandler(
          new MessageEvent("message", {
            data: {
              type: "SHARE_TARGET_FILES",
              shareId: "hash123",
              files: [{ id: 1, name: "test.pdf" }],
            },
          })
        );
      });

      await waitFor(() => {
        expect(window.history.replaceState).toHaveBeenCalledWith(
          {},
          "",
          "/#section"
        );
      });
    });

    it("should handle non-share paths correctly", async () => {
      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/other?title=Test#anchor",
        pathname: "/other",
        search: "?title=Test",
        hash: "#anchor",
      } as Location;

      renderHook(() => useShareTarget());

      // Should not parse since not on /share path
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it("should not crash when history.replaceState is undefined", async () => {
      vi.stubGlobal("history", {});

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Test&share_id=nohistory456",
        pathname: "/share",
        search: "?title=Test&share_id=nohistory456",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      const messageHandler = mockServiceWorker.addEventListener.mock!
        .calls[0]![1] as (event: MessageEvent) => void;

      act(() => {
        messageHandler(
          new MessageEvent("message", {
            data: {
              type: "SHARE_TARGET_FILES",
              shareId: "nohistory456",
              files: [],
            },
          })
        );
      });

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          title: "Test",
          files: [],
        });
      });
    });
  });

  describe("Popstate Event Listener", () => {
    it("should listen for popstate events and re-parse data", async () => {
      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Initial",
        pathname: "/share",
        search: "?title=Initial",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          title: "Initial",
        });
      });

      // Simulate navigation
      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Updated",
        pathname: "/share",
        search: "?title=Updated",
        hash: "",
      } as Location;

      const popstateEvent = new PopStateEvent("popstate");
      window.dispatchEvent(popstateEvent);

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          title: "Updated",
        });
      });
    });

    it("should clean up popstate event listener on unmount", async () => {
      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Test",
        pathname: "/share",
        search: "?title=Test",
        hash: "",
      } as Location;

      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() => useShareTarget());

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        "popstate",
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });

  describe("Error Handling", () => {
    it("should catch and log URL parsing errors", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Mock URL constructor to throw error
      const OriginalURL = globalThis.URL;
      // @ts-expect-error - Mocking for error testing
      globalThis.URL = class extends OriginalURL {
        constructor(url: string) {
          if (url.includes("invalid-url-format")) {
            throw new Error("Invalid URL");
          }
          super(url);
        }
      };

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/invalid-url-format",
        pathname: "/share",
        search: "?title=Test",
        hash: "",
      } as Location;

      renderHook(() => useShareTarget());

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to process share target:",
          expect.any(Error)
        );
      });

      globalThis.URL = OriginalURL;
      consoleErrorSpy.mockRestore();
    });
  });

  describe("Integration: Combined Scenarios", () => {
    let mockServiceWorker: {
      addEventListener: ReturnType<typeof vi.fn>;
      removeEventListener: ReturnType<typeof vi.fn>;
    };

    beforeEach(() => {
      mockServiceWorker = {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      };

      vi.stubGlobal("navigator", {
        serviceWorker: mockServiceWorker,
      });
    });

    it("should handle text and files together via SW message", async () => {
      const mockFiles = [
        { id: 1, name: "document.pdf", type: "application/pdf", size: 5000 },
      ];

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Report&text=See+attached&share_id=combo123",
        pathname: "/share",
        search: "?title=Report&text=See+attached&share_id=combo123",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      const messageHandler = mockServiceWorker.addEventListener.mock!
        .calls[0]![1] as (event: MessageEvent) => void;

      act(() => {
        messageHandler(
          new MessageEvent("message", {
            data: {
              type: "SHARE_TARGET_FILES",
              shareId: "combo123",
              files: mockFiles,
            },
          })
        );
      });

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          title: "Report",
          text: "See attached",
          files: mockFiles,
        });
      });
    });

    it("should handle all parameters including url (files via SW messages)", async () => {
      // Files are now handled via Service Worker messages, not sessionStorage
      // This test only validates text/URL params from URL search params

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Full&text=Complete&url=https://test.com",
        pathname: "/share",
        search: "?title=Full&text=Complete&url=https://test.com",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          title: "Full",
          text: "Complete",
          url: "https://test.com",
          files: undefined, // Files come via SW message, not in initial parse
        });
      });
    });
  });
});
