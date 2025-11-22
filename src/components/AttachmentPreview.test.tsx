// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { AttachmentPreview } from "./AttachmentPreview";

describe("AttachmentPreview", () => {
  const mockOnClose = vi.fn();
  const mockOnDownload = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render image preview", () => {
    const imageFile = new File(["image data"], "photo.jpg", {
      type: "image/jpeg",
    });
    const imageUrl = URL.createObjectURL(imageFile);

    render(
      <I18nProvider i18n={i18n}>
        <AttachmentPreview
          file={imageFile}
          fileUrl={imageUrl}
          onClose={mockOnClose}
          onDownload={mockOnDownload}
        />
      </I18nProvider>
    );

    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByRole("img")).toHaveAttribute("src", imageUrl);
    expect(screen.getByText("photo.jpg")).toBeInTheDocument();
  });

  it("should render PDF preview", () => {
    const pdfFile = new File(["pdf data"], "document.pdf", {
      type: "application/pdf",
    });
    const pdfUrl = URL.createObjectURL(pdfFile);

    render(
      <I18nProvider i18n={i18n}>
        <AttachmentPreview
          file={pdfFile}
          fileUrl={pdfUrl}
          onClose={mockOnClose}
          onDownload={mockOnDownload}
        />
      </I18nProvider>
    );

    expect(screen.getByTitle("PDF Preview")).toBeInTheDocument();
    expect(screen.getByText("document.pdf")).toBeInTheDocument();
  });

  it("should show unsupported preview message for other types", () => {
    const textFile = new File(["text data"], "document.txt", {
      type: "text/plain",
    });
    const textUrl = URL.createObjectURL(textFile);

    render(
      <I18nProvider i18n={i18n}>
        <AttachmentPreview
          file={textFile}
          fileUrl={textUrl}
          onClose={mockOnClose}
          onDownload={mockOnDownload}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/preview not available/i)).toBeInTheDocument();
  });

  it("should close modal when close button clicked", () => {
    const imageFile = new File(["image data"], "photo.jpg", {
      type: "image/jpeg",
    });
    const imageUrl = URL.createObjectURL(imageFile);

    render(
      <I18nProvider i18n={i18n}>
        <AttachmentPreview
          file={imageFile}
          fileUrl={imageUrl}
          onClose={mockOnClose}
          onDownload={mockOnDownload}
        />
      </I18nProvider>
    );

    const closeButton = screen.getByRole("button", { name: /close preview/i });
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should close modal when ESC key pressed", () => {
    const imageFile = new File(["image data"], "photo.jpg", {
      type: "image/jpeg",
    });
    const imageUrl = URL.createObjectURL(imageFile);

    render(
      <I18nProvider i18n={i18n}>
        <AttachmentPreview
          file={imageFile}
          fileUrl={imageUrl}
          onClose={mockOnClose}
          onDownload={mockOnDownload}
        />
      </I18nProvider>
    );

    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("should trigger download when download button clicked", () => {
    const imageFile = new File(["image data"], "photo.jpg", {
      type: "image/jpeg",
    });
    const imageUrl = URL.createObjectURL(imageFile);

    render(
      <I18nProvider i18n={i18n}>
        <AttachmentPreview
          file={imageFile}
          fileUrl={imageUrl}
          onClose={mockOnClose}
          onDownload={mockOnDownload}
        />
      </I18nProvider>
    );

    const downloadButton = screen.getByRole("button", {
      name: /download file/i,
    });
    fireEvent.click(downloadButton);

    expect(mockOnDownload).toHaveBeenCalledTimes(1);
  });

  it("should support zoom controls for images", () => {
    const imageFile = new File(["image data"], "photo.jpg", {
      type: "image/jpeg",
    });
    const imageUrl = URL.createObjectURL(imageFile);

    render(
      <I18nProvider i18n={i18n}>
        <AttachmentPreview
          file={imageFile}
          fileUrl={imageUrl}
          onClose={mockOnClose}
          onDownload={mockOnDownload}
        />
      </I18nProvider>
    );

    const zoomInButton = screen.getByRole("button", { name: /zoom in/i });
    const zoomOutButton = screen.getByRole("button", { name: /zoom out/i });

    expect(zoomInButton).toBeInTheDocument();
    expect(zoomOutButton).toBeInTheDocument();
  });

  it("should display file size", () => {
    const imageFile = new File(["x".repeat(2048)], "photo.jpg", {
      type: "image/jpeg",
    });
    const imageUrl = URL.createObjectURL(imageFile);

    render(
      <I18nProvider i18n={i18n}>
        <AttachmentPreview
          file={imageFile}
          fileUrl={imageUrl}
          onClose={mockOnClose}
          onDownload={mockOnDownload}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/2\.0 KB/i)).toBeInTheDocument();
  });

  it("should be keyboard accessible", () => {
    const imageFile = new File(["image data"], "photo.jpg", {
      type: "image/jpeg",
    });
    const imageUrl = URL.createObjectURL(imageFile);

    render(
      <I18nProvider i18n={i18n}>
        <AttachmentPreview
          file={imageFile}
          fileUrl={imageUrl}
          onClose={mockOnClose}
          onDownload={mockOnDownload}
        />
      </I18nProvider>
    );

    const closeButton = screen.getByRole("button", { name: /close preview/i });
    const downloadButton = screen.getByRole("button", {
      name: /download file/i,
    });

    expect(closeButton).toHaveAttribute("type", "button");
    expect(downloadButton).toHaveAttribute("type", "button");
  });
});
