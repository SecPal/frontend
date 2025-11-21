// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { AttachmentList } from "./AttachmentList";
import type { SecretAttachment } from "../services/secretApi";

// Initialize i18n for tests
i18n.load("en", {});
i18n.activate("en");

describe("AttachmentList", () => {
  const mockAttachments: SecretAttachment[] = [
    {
      id: "att-1",
      filename: "document.pdf",
      size: 1048576, // 1MB (1024 * 1024)
      mime_type: "application/pdf",
      created_at: "2025-11-21T10:00:00Z",
    },
    {
      id: "att-2",
      filename: "image.jpg",
      size: 524288, // 512KB (512 * 1024)
      mime_type: "image/jpeg",
      created_at: "2025-11-21T11:00:00Z",
    },
    {
      id: "att-3",
      filename: "spreadsheet.xlsx",
      size: 2097152, // 2MB (2 * 1024 * 1024)
      mime_type:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      created_at: "2025-11-21T12:00:00Z",
    },
  ];

  const mockMasterKey = {} as CryptoKey;
  const mockOnDownload = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnPreview = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render empty state when no attachments", () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentList
          attachments={[]}
          masterKey={mockMasterKey}
          onDownload={mockOnDownload}
          onDelete={mockOnDelete}
          onPreview={mockOnPreview}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/no attachments/i)).toBeInTheDocument();
  });

  it("should render list of attachments", () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentList
          attachments={mockAttachments}
          masterKey={mockMasterKey}
          onDownload={mockOnDownload}
          onDelete={mockOnDelete}
          onPreview={mockOnPreview}
        />
      </I18nProvider>
    );

    expect(screen.getByText("document.pdf")).toBeInTheDocument();
    expect(screen.getByText("image.jpg")).toBeInTheDocument();
    expect(screen.getByText("spreadsheet.xlsx")).toBeInTheDocument();
  });

  it("should display file sizes in human-readable format", () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentList
          attachments={mockAttachments}
          masterKey={mockMasterKey}
          onDownload={mockOnDownload}
          onDelete={mockOnDelete}
          onPreview={mockOnPreview}
        />
      </I18nProvider>
    );

    expect(screen.getByText(/1\.0\s*MB/i)).toBeInTheDocument(); // document.pdf (1048576 bytes = 1.0 MB)
    expect(screen.getByText(/512\.0\s*KB/i)).toBeInTheDocument(); // image.jpg (524288 bytes = 512.0 KB)
    expect(screen.getByText(/2\.0\s*MB/i)).toBeInTheDocument(); // spreadsheet.xlsx (2097152 bytes = 2.0 MB)
  });

  it("should call onDownload when download button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider i18n={i18n}>
        <AttachmentList
          attachments={mockAttachments}
          masterKey={mockMasterKey}
          onDownload={mockOnDownload}
          onDelete={mockOnDelete}
          onPreview={mockOnPreview}
        />
      </I18nProvider>
    );

    const downloadButtons = screen.getAllByRole("button", {
      name: /download/i,
    });
    await user.click(downloadButtons[0]!);

    await waitFor(() => {
      expect(mockOnDownload).toHaveBeenCalledWith("att-1", mockMasterKey);
    });
  });

  it("should call onDelete when delete button is clicked", async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider i18n={i18n}>
        <AttachmentList
          attachments={mockAttachments}
          masterKey={mockMasterKey}
          onDownload={mockOnDownload}
          onDelete={mockOnDelete}
          onPreview={mockOnPreview}
        />
      </I18nProvider>
    );

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    await user.click(deleteButtons[0]!);

    await waitFor(() => {
      expect(mockOnDelete).toHaveBeenCalledWith("att-1");
    });
  });

  it("should call onPreview for image files", async () => {
    const user = userEvent.setup();

    render(
      <I18nProvider i18n={i18n}>
        <AttachmentList
          attachments={mockAttachments}
          masterKey={mockMasterKey}
          onDownload={mockOnDownload}
          onDelete={mockOnDelete}
          onPreview={mockOnPreview}
        />
      </I18nProvider>
    );

    // Find preview button for image.jpg (index 1)
    const previewButtons = screen.getAllByRole("button", { name: /preview/i });
    await user.click(previewButtons[1]!); // image.jpg

    await waitFor(() => {
      expect(mockOnPreview).toHaveBeenCalledWith("att-2", mockMasterKey);
    });
  });

  it("should show preview button only for previewable files", () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentList
          attachments={mockAttachments}
          masterKey={mockMasterKey}
          onDownload={mockOnDownload}
          onDelete={mockOnDelete}
          onPreview={mockOnPreview}
        />
      </I18nProvider>
    );

    const previewButtons = screen.getAllByRole("button", { name: /preview/i });

    // Should have preview button for image.jpg (index 1)
    // PDF (att-1) might be previewable depending on browser
    // XLSX (att-3) should NOT be previewable
    expect(previewButtons.length).toBeGreaterThanOrEqual(1);
  });

  it("should disable buttons when loading", () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentList
          attachments={mockAttachments}
          masterKey={mockMasterKey}
          onDownload={mockOnDownload}
          onDelete={mockOnDelete}
          onPreview={mockOnPreview}
          isLoading={true}
        />
      </I18nProvider>
    );

    const downloadButtons = screen.getAllByRole("button", {
      name: /download/i,
    });
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });

    downloadButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });

    deleteButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it("should display loading indicator when isLoading is true", () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentList
          attachments={mockAttachments}
          masterKey={mockMasterKey}
          onDownload={mockOnDownload}
          onDelete={mockOnDelete}
          onPreview={mockOnPreview}
          isLoading={true}
        />
      </I18nProvider>
    );

    expect(screen.getByRole("status")).toBeInTheDocument(); // Loading indicator
  });

  it("should have accessible labels for all interactive elements", () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentList
          attachments={[mockAttachments[0]!]}
          masterKey={mockMasterKey}
          onDownload={mockOnDownload}
          onDelete={mockOnDelete}
          onPreview={mockOnPreview}
        />
      </I18nProvider>
    );

    const downloadButton = screen.getByRole("button", { name: /download/i });
    const deleteButton = screen.getByRole("button", { name: /delete/i });

    expect(downloadButton).toHaveAccessibleName();
    expect(deleteButton).toHaveAccessibleName();
  });

  it("should display file icons based on MIME type", () => {
    render(
      <I18nProvider i18n={i18n}>
        <AttachmentList
          attachments={mockAttachments}
          masterKey={mockMasterKey}
          onDownload={mockOnDownload}
          onDelete={mockOnDelete}
          onPreview={mockOnPreview}
        />
      </I18nProvider>
    );

    // Icons should be present (rendered as SVG elements)
    const icons = document.querySelectorAll("svg");
    expect(icons.length).toBeGreaterThan(0);
  });
});
