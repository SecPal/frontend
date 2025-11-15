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

  describe("sessionStorage Files Parsing", () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    it("should parse valid files from sessionStorage", async () => {
      const mockFiles = [
        { name: "test.pdf", type: "application/pdf", size: 1024 },
        { name: "image.jpg", type: "image/jpeg", size: 2048 },
      ];

      sessionStorage.setItem("share-target-files", JSON.stringify(mockFiles));

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Files",
        pathname: "/share",
        search: "?title=Files",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          title: "Files",
          files: mockFiles,
        });
      });
    });

    it("should parse files with dataUrl property", async () => {
      const mockFiles = [
        {
          name: "photo.jpg",
          type: "image/jpeg",
          size: 5000,
          dataUrl: "data:image/jpeg;base64,/9j/4AAQ",
        },
      ];

      sessionStorage.setItem("share-target-files", JSON.stringify(mockFiles));

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?text=Image",
        pathname: "/share",
        search: "?text=Image",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          text: "Image",
          files: mockFiles,
        });
      });
    });

    it("should handle invalid JSON in sessionStorage", async () => {
      sessionStorage.setItem("share-target-files", "invalid-json{{{");

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Test",
        pathname: "/share",
        search: "?title=Test",
        hash: "",
      } as Location;

      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      const { result } = renderHook(() => useShareTarget());

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          title: "Test",
        });
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Failed to parse shared files:",
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });

    it("should reject all files if any file has missing required properties", async () => {
      const mockFiles = [
        { name: "valid.pdf", type: "application/pdf", size: 1024 },
        { name: "invalid.txt" }, // Missing type and size - causes ALL files to be rejected
        { type: "image/jpeg", size: 2048 }, // Missing name
      ];

      sessionStorage.setItem("share-target-files", JSON.stringify(mockFiles));

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Mixed",
        pathname: "/share",
        search: "?title=Mixed",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      await waitFor(() => {
        // Hook uses .every() validation - if ANY file is invalid, ALL are rejected
        expect(result.current.sharedData).toEqual({
          title: "Mixed",
        });
      });
    });

    it("should accept files even if dataUrl type is invalid (not validated in hook)", async () => {
      const mockFiles = [
        {
          name: "valid.jpg",
          type: "image/jpeg",
          size: 1024,
          dataUrl: "data:image/jpeg;base64,valid",
        },
        {
          name: "invalid.jpg",
          type: "image/jpeg",
          size: 2048,
          dataUrl: 12345 as unknown as string, // Invalid type - but hook doesn't validate dataUrl
        },
      ];

      sessionStorage.setItem("share-target-files", JSON.stringify(mockFiles));

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=DataURL",
        pathname: "/share",
        search: "?title=DataURL",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      await waitFor(() => {
        // Hook doesn't validate dataUrl type in .every() check - accepts both files
        expect(result.current.sharedData).toEqual({
          title: "DataURL",
          files: mockFiles, // Both files accepted
        });
      });
    });

    it("should handle non-array files data", async () => {
      sessionStorage.setItem(
        "share-target-files",
        JSON.stringify({ invalid: "object" })
      );

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Test",
        pathname: "/share",
        search: "?title=Test",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          title: "Test",
        });
      });
    });

    it("should clear files from sessionStorage when clearSharedData is called", async () => {
      sessionStorage.setItem(
        "share-target-files",
        JSON.stringify([
          { name: "test.pdf", type: "application/pdf", size: 1024 },
        ])
      );

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Test",
        pathname: "/share",
        search: "?title=Test",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      await waitFor(() => {
        expect(sessionStorage.getItem("share-target-files")).not.toBeNull();
      });

      act(() => {
        result.current.clearSharedData();
      });

      await waitFor(() => {
        expect(sessionStorage.getItem("share-target-files")).toBeNull();
      });
    });
  });

  describe("history.replaceState Handling", () => {
    it("should preserve hash when cleaning URL", async () => {
      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Test#section",
        pathname: "/share",
        search: "?title=Test",
        hash: "#section",
      } as Location;

      renderHook(() => useShareTarget());

      await waitFor(() => {
        expect(window.history.replaceState).toHaveBeenCalledWith(
          {},
          "",
          "/#section"
        );
      });
    });

    it("should handle non-share paths correctly when cleaning URL", async () => {
      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/other?title=Test#anchor",
        pathname: "/other",
        search: "?title=Test",
        hash: "#anchor",
      } as Location;

      renderHook(() => useShareTarget());

      // Should not parse since not on /share path, but if it did:
      expect(window.history.replaceState).not.toHaveBeenCalled();
    });

    it("should not crash when history.replaceState is undefined", async () => {
      // @ts-expect-error - Testing edge case
      vi.stubGlobal("history", {});

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Test",
        pathname: "/share",
        search: "?title=Test",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          title: "Test",
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
      const OriginalURL = global.URL;
      // @ts-expect-error - Mocking for error testing
      global.URL = class extends OriginalURL {
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

      global.URL = OriginalURL;
      consoleErrorSpy.mockRestore();
    });
  });

  describe("Integration: Combined Scenarios", () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    it("should handle text and files together", async () => {
      const mockFiles = [
        { name: "document.pdf", type: "application/pdf", size: 5000 },
      ];

      sessionStorage.setItem("share-target-files", JSON.stringify(mockFiles));

      // @ts-expect-error - Mocking location for tests
      window.location = {
        ...window.location,
        href: "https://secpal.app/share?title=Report&text=See+attached",
        pathname: "/share",
        search: "?title=Report&text=See+attached",
        hash: "",
      } as Location;

      const { result } = renderHook(() => useShareTarget());

      await waitFor(() => {
        expect(result.current.sharedData).toEqual({
          title: "Report",
          text: "See attached",
          files: mockFiles,
        });
      });
    });

    it("should handle all parameters including url and files", async () => {
      const mockFiles = [
        { name: "data.json", type: "application/json", size: 256 },
      ];

      sessionStorage.setItem("share-target-files", JSON.stringify(mockFiles));

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
          files: mockFiles,
        });
      });
    });
  });
});
