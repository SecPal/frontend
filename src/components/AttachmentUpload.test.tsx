// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { AttachmentUpload } from "./AttachmentUpload";

describe("AttachmentUpload", () => {
  const mockOnUpload = vi.fn();
  const mockOnError = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render upload zone", () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentUpload onUpload={mockOnUpload} />
      </I18nProvider>
    );

    expect(
      screen.getByText(/drag files here or click to browse/i)
    ).toBeInTheDocument();
  });

  it("should handle file selection via input", async () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentUpload onUpload={mockOnUpload} />
      </I18nProvider>
    );

    const file = new File(["test content"], "test.txt", { type: "text/plain" });
    const input = screen.getByLabelText(/select files/i);

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith(file);
    });
  });

  it("should handle drag and drop", async () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentUpload onUpload={mockOnUpload} />
      </I18nProvider>
    );

    const file = new File(["test content"], "test.txt", { type: "text/plain" });
    const dropZone = screen.getByText(/drag files here/i).closest("div");

    fireEvent.dragOver(dropZone!);
    fireEvent.drop(dropZone!, {
      dataTransfer: { files: [file] },
    });

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith(file);
    });
  });

  it("should validate file size (max 10MB)", async () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentUpload onUpload={mockOnUpload} onError={mockOnError} />
      </I18nProvider>
    );

    // Create a file > 10MB
    const largeFile = new File(["x".repeat(11 * 1024 * 1024)], "large.txt", {
      type: "text/plain",
    });
    const input = screen.getByLabelText(/select files/i);

    fireEvent.change(input, { target: { files: [largeFile] } });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining("10MB"));
      expect(mockOnUpload).not.toHaveBeenCalled();
    });
  });

  it("should validate file type (allow images, PDFs, documents)", async () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentUpload onUpload={mockOnUpload} onError={mockOnError} />
      </I18nProvider>
    );

    const executableFile = new File(["malicious"], "virus.exe", {
      type: "application/x-msdownload",
    });
    const input = screen.getByLabelText(/select files/i);

    fireEvent.change(input, { target: { files: [executableFile] } });

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(
        expect.stringContaining("file type")
      );
      expect(mockOnUpload).not.toHaveBeenCalled();
    });
  });

  it("should allow valid file types (images)", async () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentUpload onUpload={mockOnUpload} />
      </I18nProvider>
    );

    const imageFile = new File(["image data"], "photo.jpg", {
      type: "image/jpeg",
    });
    const input = screen.getByLabelText(/select files/i);

    fireEvent.change(input, { target: { files: [imageFile] } });

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith(imageFile);
    });
  });

  it("should allow valid file types (PDFs)", async () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentUpload onUpload={mockOnUpload} />
      </I18nProvider>
    );

    const pdfFile = new File(["pdf data"], "document.pdf", {
      type: "application/pdf",
    });
    const input = screen.getByLabelText(/select files/i);

    fireEvent.change(input, { target: { files: [pdfFile] } });

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith(pdfFile);
    });
  });

  it("should show loading state when uploading", () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentUpload onUpload={mockOnUpload} isUploading={true} />
      </I18nProvider>
    );

    expect(screen.getAllByText(/uploading/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/select files/i)).toBeDisabled();
  });

  it("should show progress bar during upload", () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentUpload
          onUpload={mockOnUpload}
          isUploading={true}
          uploadProgress={65}
        />
      </I18nProvider>
    );

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toBeInTheDocument();
    expect(progressBar).toHaveAttribute("aria-valuenow", "65");
  });

  it("should display multiple file selection info", async () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentUpload onUpload={mockOnUpload} />
      </I18nProvider>
    );

    const files = [
      new File(["content1"], "file1.txt", { type: "text/plain" }),
      new File(["content2"], "file2.txt", { type: "text/plain" }),
    ];
    const input = screen.getByLabelText(/select files/i);

    fireEvent.change(input, { target: { files } });

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledTimes(2);
      expect(mockOnUpload).toHaveBeenCalledWith(files[0]);
      expect(mockOnUpload).toHaveBeenCalledWith(files[1]);
    });
  });

  it("should show supported file types hint", () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentUpload onUpload={mockOnUpload} />
      </I18nProvider>
    );

    expect(
      screen.getByText(/supported.*images.*pdfs.*documents.*10mb/i)
    ).toBeInTheDocument();
  });

  it("should be keyboard accessible", () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentUpload onUpload={mockOnUpload} />
      </I18nProvider>
    );

    const input = screen.getByLabelText(/select files/i);
    expect(input).toHaveAttribute("type", "file");
    expect(input).toHaveAttribute("tabindex", "0");
  });
});
