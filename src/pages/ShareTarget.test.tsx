// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ShareTarget } from "./ShareTarget";

describe("ShareTarget Component", () => {
  beforeEach(() => {
    // Setup i18n
    i18n.load("en", {});
    i18n.activate("en");

    // Reset window.location
    Object.defineProperty(window, "location", {
      value: {
        pathname: "/share",
        search: "",
        hash: "",
        href: "http://localhost:5173/share",
      },
      writable: true,
      configurable: true,
    });
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
      window.location.search = "?title=Test&text=Hello&url=https://example.com";

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/Test/)).toBeInTheDocument();
        expect(screen.getByText(/Hello/)).toBeInTheDocument();
        expect(screen.getByText(/example\.com/)).toBeInTheDocument();
      });
    });

    it("should handle empty URL parameters gracefully", () => {
      window.location.search = "?title=&text=&url=";

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
        expect(screen.getByText(/document\.pdf/)).toBeInTheDocument();
        expect(screen.queryByText(/script\.exe/)).not.toBeInTheDocument();
        expect(screen.getByText(/Invalid file type/i)).toBeInTheDocument();
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
        dataUrl: "data:image/jpeg;base64,fakebase64data",
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
      window.location.search = "?title=Report&text=See+attached";
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
      window.location.search = "?text=Hello";
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
      const replaceStateSpy = vi.spyOn(window.history, "replaceState");
      window.location.search = "?title=Test&text=Hello";

      renderComponent();

      await waitFor(() => {
        expect(replaceStateSpy).toHaveBeenCalledWith(
          {},
          "",
          expect.stringContaining("/")
        );
      });
    });
  });
});
