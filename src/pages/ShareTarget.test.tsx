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

      const clearButton = await screen.findByRole("button", { name: /clear/i });
      clearButton.click();

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
});
