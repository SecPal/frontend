// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { UploadStatus } from "./UploadStatus";
import * as fileQueueHook from "../hooks/useFileQueue";

// Mock useFileQueue hook
vi.mock("../hooks/useFileQueue");

describe("UploadStatus Component", () => {
  const mockFileQueue = {
    encrypted: [],
    failed: [],
    isProcessing: false,
    clearCompleted: vi.fn(),
    deleteFile: vi.fn(),
    retryFailed: vi.fn(),
    registerEncryptedUploadSync: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup i18n with English locale
    i18n.load("en", {});
    i18n.activate("en");

    vi.spyOn(fileQueueHook, "useFileQueue").mockReturnValue({
      ...mockFileQueue,
      allFiles: [],
      pending: [],
      quota: null,
      processQueue: vi.fn(),
      registerBackgroundSync: vi.fn(),
    });
  });

  function renderWithI18n(component: React.ReactElement) {
    return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
  }

  it("should not render when queue is empty", () => {
    const { container } = renderWithI18n(<UploadStatus />);
    expect(container.firstChild).toBeNull();
  });

  it("should render upload queue with encrypted files", () => {
    vi.spyOn(fileQueueHook, "useFileQueue").mockReturnValue({
      ...mockFileQueue,
      encrypted: [
        {
          id: "file-1",
          file: new Blob(),
          metadata: {
            name: "document.pdf",
            type: "application/pdf",
            size: 1024,
            timestamp: Date.now(),
          },
          uploadState: "encrypted",
          retryCount: 0,
          createdAt: new Date(),
        },
      ],
      allFiles: [],
      pending: [],
      quota: null,
      processQueue: vi.fn(),
      registerBackgroundSync: vi.fn(),
    });

    renderWithI18n(<UploadStatus />);

    expect(screen.getByText("Upload Queue")).toBeInTheDocument();
    expect(screen.getByText("document.pdf")).toBeInTheDocument();
    expect(screen.getByText("1 file ready for upload")).toBeInTheDocument();
  });

  it("should display progress bar with correct percentage", () => {
    vi.spyOn(fileQueueHook, "useFileQueue").mockReturnValue({
      ...mockFileQueue,
      encrypted: [
        {
          id: "file-1",
          file: new Blob(),
          metadata: {
            name: "file1.txt",
            type: "text/plain",
            size: 100,
            timestamp: Date.now(),
          },
          uploadState: "encrypted",
          retryCount: 0,
          createdAt: new Date(),
        },
      ],
      failed: [
        {
          id: "file-2",
          file: new Blob(),
          metadata: {
            name: "file2.txt",
            type: "text/plain",
            size: 200,
            timestamp: Date.now(),
          },
          uploadState: "failed",
          retryCount: 5,
          error: "Upload failed",
          createdAt: new Date(),
        },
      ],
      allFiles: [],
      pending: [],
      quota: null,
      processQueue: vi.fn(),
      registerBackgroundSync: vi.fn(),
    });

    renderWithI18n(<UploadStatus />);

    const progressBar = screen.getByRole("progressbar");
    expect(progressBar).toHaveAttribute("aria-valuenow", "50"); // 1 processed (failed) out of 2 total = 50%
  });

  it("should show failed files with error messages", () => {
    vi.spyOn(fileQueueHook, "useFileQueue").mockReturnValue({
      ...mockFileQueue,
      failed: [
        {
          id: "failed-1",
          file: new Blob(),
          metadata: {
            name: "failed.pdf",
            type: "application/pdf",
            size: 500,
            timestamp: Date.now(),
          },
          uploadState: "failed",
          retryCount: 5,
          error: "Network timeout",
          createdAt: new Date(),
        },
      ],
      allFiles: [],
      pending: [],
      quota: null,
      processQueue: vi.fn(),
      registerBackgroundSync: vi.fn(),
    });

    renderWithI18n(<UploadStatus />);

    expect(screen.getByText("failed.pdf")).toBeInTheDocument();
    expect(screen.getByText("Network timeout")).toBeInTheDocument();
    expect(screen.getByText("Retry Failed")).toBeInTheDocument();
  });

  it("should call registerEncryptedUploadSync when retry button clicked", async () => {
    const mockRetryFailed = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(fileQueueHook, "useFileQueue").mockReturnValue({
      ...mockFileQueue,
      failed: [
        {
          id: "failed-1",
          file: new Blob(),
          metadata: {
            name: "test.txt",
            type: "text/plain",
            size: 100,
            timestamp: Date.now(),
          },
          uploadState: "failed",
          retryCount: 3,
          createdAt: new Date(),
        },
      ],
      retryFailed: mockRetryFailed,
      allFiles: [],
      pending: [],
      quota: null,
      processQueue: vi.fn(),
      registerBackgroundSync: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithI18n(<UploadStatus />);

    const retryButton = screen.getByText("Retry Failed");
    await user.click(retryButton);

    expect(mockRetryFailed).toHaveBeenCalledOnce();
  });

  it("should call deleteFile when delete button clicked", async () => {
    const mockDeleteFile = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(fileQueueHook, "useFileQueue").mockReturnValue({
      ...mockFileQueue,
      encrypted: [
        {
          id: "file-1",
          file: new Blob(),
          metadata: {
            name: "delete-me.txt",
            type: "text/plain",
            size: 100,
            timestamp: Date.now(),
          },
          uploadState: "encrypted",
          retryCount: 0,
          createdAt: new Date(),
        },
      ],
      deleteFile: mockDeleteFile,
      allFiles: [],
      pending: [],
      quota: null,
      processQueue: vi.fn(),
      registerBackgroundSync: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithI18n(<UploadStatus />);

    const deleteButton = screen.getByLabelText("Remove delete-me.txt");
    await user.click(deleteButton);

    expect(mockDeleteFile).toHaveBeenCalledWith("file-1");
  });

  it("should show success notification after retry", async () => {
    const mockRetryFailed = vi.fn().mockResolvedValue(undefined);

    vi.spyOn(fileQueueHook, "useFileQueue").mockReturnValue({
      ...mockFileQueue,
      failed: [
        {
          id: "failed-1",
          file: new Blob(),
          metadata: {
            name: "test.txt",
            type: "text/plain",
            size: 100,
            timestamp: Date.now(),
          },
          uploadState: "failed",
          retryCount: 2,
          createdAt: new Date(),
        },
      ],
      retryFailed: mockRetryFailed,
      allFiles: [],
      pending: [],
      quota: null,
      processQueue: vi.fn(),
      registerBackgroundSync: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithI18n(<UploadStatus />);

    const retryButton = screen.getByText("Retry Failed");
    await user.click(retryButton);

    await waitFor(() => {
      expect(
        screen.getByText(
          "Retry scheduled. Files will upload when network is available."
        )
      ).toBeInTheDocument();
    });
  });

  it("should call clearCompleted when clear button clicked", async () => {
    const mockClearCompleted = vi.fn().mockResolvedValue(3);

    vi.spyOn(fileQueueHook, "useFileQueue").mockReturnValue({
      ...mockFileQueue,
      encrypted: [
        {
          id: "file-1",
          file: new Blob(),
          metadata: {
            name: "test.txt",
            type: "text/plain",
            size: 100,
            timestamp: Date.now(),
          },
          uploadState: "encrypted",
          retryCount: 0,
          createdAt: new Date(),
        },
      ],
      clearCompleted: mockClearCompleted,
      allFiles: [],
      pending: [],
      quota: null,
      processQueue: vi.fn(),
      registerBackgroundSync: vi.fn(),
    });

    const user = userEvent.setup();
    renderWithI18n(<UploadStatus />);

    const clearButton = screen.getByText("Clear Completed");
    await user.click(clearButton);

    expect(mockClearCompleted).toHaveBeenCalledOnce();

    await waitFor(() => {
      expect(
        screen.getByText("Cleared 3 completed upload(s)")
      ).toBeInTheDocument();
    });
  });
});
