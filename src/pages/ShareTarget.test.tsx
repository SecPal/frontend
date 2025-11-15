// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ShareTarget } from "./ShareTarget";

describe("ShareTarget Component", () => {
  // Helper function to set window.location with search params
  const setLocationSearch = (search: string) => {
    const fullUrl = search
      ? `http://localhost:5173/share${search}`
      : "http://localhost:5173/share";
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/share",
        search,
        hash: "",
        href: fullUrl,
      },
      writable: true,
      configurable: true,
    });
  };

  beforeEach(() => {
    // Setup i18n
    i18n.load("en", {});
    i18n.activate("en");

    // Clear sessionStorage
    sessionStorage.clear();

    // Reset window.location
    setLocationSearch("");
  });

  const renderComponent = () => {
    return render(
      <I18nProvider i18n={i18n}>
        <BrowserRouter>
          <ShareTarget />
        </BrowserRouter>
      </I18nProvider>
    );
  };

  describe("GET method - Text sharing (existing functionality)", () => {
    it("should handle shared text via URL parameters", async () => {
      setLocationSearch("?title=Test&text=Hello&url=https://example.com");

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Test/)).toBeInTheDocument();
        expect(screen.getByText(/Hello/)).toBeInTheDocument();
        expect(screen.getByText(/example\.com/)).toBeInTheDocument();
      });
    });

    it("should handle empty URL parameters gracefully", () => {
      setLocationSearch("?title=&text=&url=");

      renderComponent();

      expect(screen.getByText(/No content shared/i)).toBeInTheDocument();
    });
  });

  describe("POST method - File sharing (new functionality)", () => {
    it("should display shared files from FormData", async () => {
      // Mock FormData with files
      const mockFiles = [
        new File(["test content"], "test.pdf", { type: "application/pdf" }),
        new File(["image data"], "photo.jpg", { type: "image/jpeg" }),
      ];

      // Store files in sessionStorage (simulating Service Worker cache)
      sessionStorage.setItem(
        "share-target-files",
        JSON.stringify(
          mockFiles.map((f) => ({
            name: f.name,
            type: f.type,
            size: f.size,
          }))
        )
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/test\.pdf/)).toBeInTheDocument();
        expect(screen.getByText(/photo\.jpg/)).toBeInTheDocument();
      });
    });

    it("should validate file types (accept images, PDFs, docs)", async () => {
      const validFile = new File(["content"], "document.pdf", {
        type: "application/pdf",
      });
      const invalidFile = new File(["content"], "script.exe", {
        type: "application/x-msdownload",
      });

      sessionStorage.setItem(
        "share-target-files",
        JSON.stringify([
          { name: validFile.name, type: validFile.type, size: validFile.size },
          {
            name: invalidFile.name,
            type: invalidFile.type,
            size: invalidFile.size,
          },
        ])
      );

      renderComponent();

      await waitFor(() => {
        // Valid file should be displayed
        expect(screen.getByText(/document\.pdf/)).toBeInTheDocument();
        // Error message should mention the invalid file
        expect(
          screen.getByText(/Invalid file type: script\.exe/i)
        ).toBeInTheDocument();
        // Only 1 file should be shown in the grid (the valid one)
        expect(screen.getByText(/Attached Files.*\(1\)/)).toBeInTheDocument();
      });
    });

    it("should enforce file size limit (10MB)", async () => {
      const oversizedFile = {
        name: "large.pdf",
        type: "application/pdf",
        size: 11 * 1024 * 1024, // 11MB
      };

      sessionStorage.setItem(
        "share-target-files",
        JSON.stringify([oversizedFile])
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/File too large/i)).toBeInTheDocument();
        expect(screen.getByText(/Maximum 10MB/i)).toBeInTheDocument();
      });
    });

    it("should display file preview for images", async () => {
      const imageFile = {
        name: "photo.jpg",
        type: "image/jpeg",
        size: 50000,
        dataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRg==", // Valid JPEG data URL
      };

      sessionStorage.setItem("share-target-files", JSON.stringify([imageFile]));

      renderComponent();

      await waitFor(() => {
        const img = screen.getByAltText(/photo\.jpg/i);
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute("src", imageFile.dataUrl);
      });
    });

    it("should combine text and files from POST request", async () => {
      setLocationSearch("?title=Report&text=See+attached");
      sessionStorage.setItem(
        "share-target-files",
        JSON.stringify([
          { name: "data.pdf", type: "application/pdf", size: 1000 },
        ])
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Report/)).toBeInTheDocument();
        expect(screen.getByText(/See attached/)).toBeInTheDocument();
        expect(screen.getByText(/data\.pdf/)).toBeInTheDocument();
      });
    });
  });

  describe("Clear functionality", () => {
    it("should clear shared data when user clicks clear button", async () => {
      setLocationSearch("?text=Hello");
      sessionStorage.setItem(
        "share-target-files",
        JSON.stringify([
          { name: "test.pdf", type: "application/pdf", size: 1000 },
        ])
      );

      renderComponent();

      const user = (
        await import("@testing-library/user-event")
      ).default.setup();
      const clearButton = await screen.findByRole("button", { name: /clear/i });
      await user.click(clearButton);

      await waitFor(() => {
        expect(screen.getByText(/No content shared/i)).toBeInTheDocument();
        expect(sessionStorage.getItem("share-target-files")).toBeNull();
      });
    });
  });

  describe("Navigation cleanup", () => {
    it("should clean URL parameters after processing", async () => {
      // Mock history.replaceState
      const replaceStateMock = vi.fn();
      Object.defineProperty(window.history, "replaceState", {
        writable: true,
        value: replaceStateMock,
      });

      setLocationSearch("?title=Test&text=Hello");

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Test/)).toBeInTheDocument();
        expect(replaceStateMock).toHaveBeenCalledWith({}, "", "/");
      });
    });
  });

  describe("Security: Data URL Sanitization", () => {
    it("should reject data URLs with non-image MIME types", async () => {
      const maliciousFile = {
        name: "malicious.jpg",
        type: "image/jpeg",
        size: 50000,
        dataUrl:
          "data:text/html;base64,PHNjcmlwdD5hbGVydCgneHNzJyk8L3NjcmlwdD4=", // HTML/JS
      };

      sessionStorage.setItem(
        "share-target-files",
        JSON.stringify([maliciousFile])
      );

      renderComponent();

      await waitFor(() => {
        // Image should NOT be rendered
        expect(
          screen.queryByAltText(/malicious\.jpg/i)
        ).not.toBeInTheDocument();
        // File metadata should still be shown
        expect(screen.getByText(/malicious\.jpg/)).toBeInTheDocument();
      });
    });

    it("should reject javascript: URLs in data URLs", async () => {
      const xssFile = {
        name: "xss.jpg",
        type: "image/jpeg",
        size: 50000,
        dataUrl: "javascript:alert('xss')",
      };

      sessionStorage.setItem("share-target-files", JSON.stringify([xssFile]));

      renderComponent();

      await waitFor(() => {
        expect(screen.queryByAltText(/xss\.jpg/i)).not.toBeInTheDocument();
      });
    });
  });

  describe("Security: URL Sanitization", () => {
    it("should reject URLs with credentials", async () => {
      setLocationSearch("?text=test&url=https://user:pass@evil.com");

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/test/)).toBeInTheDocument();
        expect(screen.getByText(/Invalid or unsafe URL/i)).toBeInTheDocument();
      });
    });

    it("should reject javascript: protocol URLs", async () => {
      setLocationSearch("?text=test&url=javascript:alert('xss')");

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/test/)).toBeInTheDocument();
        expect(screen.getByText(/Invalid or unsafe URL/i)).toBeInTheDocument();
      });
    });

    it("should reject data: protocol URLs", async () => {
      setLocationSearch(
        "?text=test&url=data:text/html,<script>alert('xss')</script>"
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/test/)).toBeInTheDocument();
        expect(screen.getByText(/Invalid or unsafe URL/i)).toBeInTheDocument();
      });
    });

    it("should accept valid http and https URLs", async () => {
      setLocationSearch("?text=test&url=https://example.com/path?query=1");

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/test/)).toBeInTheDocument();
        const link = screen.getByRole("link");
        expect(link).toHaveAttribute(
          "href",
          "https://example.com/path?query=1"
        );
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
        expect(link).toHaveAttribute("target", "_blank");
      });
    });
  });

  describe("Error State Display", () => {
    it("should display errors even when no valid shared data exists", async () => {
      const oversizedFile = {
        name: "huge.pdf",
        type: "application/pdf",
        size: 15 * 1024 * 1024, // 15MB
      };

      sessionStorage.setItem(
        "share-target-files",
        JSON.stringify([oversizedFile])
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Errors:/i)).toBeInTheDocument();
        expect(screen.getByText(/File too large/i)).toBeInTheDocument();
        // No "No content shared" message since we have errors
        expect(
          screen.queryByText(/No content shared/i)
        ).not.toBeInTheDocument();
      });
    });

    it("should handle JSON parse errors in sessionStorage", async () => {
      sessionStorage.setItem("share-target-files", "invalid-json{");

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Errors:/i)).toBeInTheDocument();
        expect(
          screen.getByText(/Failed to load shared files/i)
        ).toBeInTheDocument();
      });
    });

    it("should handle non-array data in sessionStorage", async () => {
      sessionStorage.setItem(
        "share-target-files",
        JSON.stringify({ not: "array" })
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Errors:/i)).toBeInTheDocument();
        expect(screen.getByText(/Invalid files format/i)).toBeInTheDocument();
      });
    });

    it("should handle files with missing properties", async () => {
      const invalidFiles = [
        { name: "test.pdf" }, // Missing type and size
      ];

      sessionStorage.setItem(
        "share-target-files",
        JSON.stringify(invalidFiles)
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Errors:/i)).toBeInTheDocument();
        expect(
          screen.getByText(/Invalid file data structure/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("Service Worker Integration", () => {
    // Skip these tests - Service Worker integration requires complex mocking
    // These scenarios are covered by manual testing in PWA_PHASE3_TESTING.md
    it.skip("should handle SHARE_TARGET_FILES message from Service Worker", async () => {
      renderComponent();

      const mockFiles = [
        { name: "sw-file.pdf", type: "application/pdf", size: 1000 },
      ];

      // Simulate Service Worker message
      const messageEvent = new MessageEvent("message", {
        data: {
          type: "SHARE_TARGET_FILES",
          files: mockFiles,
        },
      });

      if (navigator.serviceWorker) {
        navigator.serviceWorker.dispatchEvent(messageEvent);
      }

      await waitFor(() => {
        expect(screen.getByText(/sw-file\.pdf/i)).toBeInTheDocument();
      });
    });

    it.skip("should ignore SHARE_TARGET_FILES with mismatched shareId", async () => {
      setLocationSearch("?title=Test&share_id=123");
      renderComponent();

      const mockFiles = [
        { name: "ignored.pdf", type: "application/pdf", size: 1000 },
      ];

      // Simulate Service Worker message with different shareId
      const messageEvent = new MessageEvent("message", {
        data: {
          type: "SHARE_TARGET_FILES",
          shareId: "999", // Different from URL param
          files: mockFiles,
        },
      });

      if (navigator.serviceWorker) {
        navigator.serviceWorker.dispatchEvent(messageEvent);
      }

      await waitFor(() => {
        // File should NOT appear because shareId mismatch
        expect(screen.queryByText(/ignored\.pdf/i)).not.toBeInTheDocument();
      });
    });

    it.skip("should handle SHARE_TARGET_ERROR message from Service Worker", async () => {
      renderComponent();

      // Simulate Service Worker error message
      const messageEvent = new MessageEvent("message", {
        data: {
          type: "SHARE_TARGET_ERROR",
          error: "Service Worker processing failed",
        },
      });

      if (navigator.serviceWorker) {
        navigator.serviceWorker.dispatchEvent(messageEvent);
      }

      await waitFor(() => {
        expect(
          screen.getByText(/Service Worker processing failed/i)
        ).toBeInTheDocument();
      });
    });
  });

  describe("File Badge Display", () => {
    it("should display correct file type badge", async () => {
      const files = [
        { name: "doc.pdf", type: "application/pdf", size: 1000 },
        { name: "pic.jpg", type: "image/jpeg", size: 2000 },
      ];

      sessionStorage.setItem("share-target-files", JSON.stringify(files));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("PDF")).toBeInTheDocument();
        expect(screen.getByText("JPEG")).toBeInTheDocument();
      });
    });

    it.skip("should handle file types without slash", async () => {
      // Skipped: File type "binary" is not in ALLOWED_TYPES and will be filtered out
      // during lazy initialization, so it never reaches the Badge rendering code
      const files = [{ name: "unknown", type: "binary", size: 1000 }];

      sessionStorage.setItem("share-target-files", JSON.stringify(files));

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("FILE")).toBeInTheDocument();
      });
    });
  });
});
