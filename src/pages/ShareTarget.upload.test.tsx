// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ShareTarget } from "./ShareTarget";
import * as secretApi from "../services/secretApi";
import * as fileQueue from "../lib/fileQueue";

// Mock modules
vi.mock("../services/secretApi");
vi.mock("../lib/fileQueue");

const originalServiceWorkerDescriptor = Object.getOwnPropertyDescriptor(
  navigator,
  "serviceWorker"
);

function setupServiceWorkerMock() {
  const listeners: Array<(event: MessageEvent) => void> = [];
  const serviceWorker = {
    controller: {
      postMessage: vi.fn(),
    },
    addEventListener: vi.fn(
      (type: string, listener: EventListenerOrEventListenerObject) => {
        if (type === "message" && typeof listener === "function") {
          listeners.push(listener as (event: MessageEvent) => void);
        }
      }
    ),
    removeEventListener: vi.fn(),
  };

  Object.defineProperty(navigator, "serviceWorker", {
    value: serviceWorker,
    configurable: true,
    writable: true,
  });

  return { serviceWorker, listeners };
}

// Wrapper component with I18n
const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <I18nProvider i18n={i18n}>{children}</I18nProvider>
);

describe("ShareTarget - Upload Functionality", () => {
  beforeEach(async () => {
    // Reset mocks
    vi.clearAllMocks();

    // Mock fetchSecrets
    vi.mocked(secretApi.fetchSecrets).mockResolvedValue([
      {
        id: "secret-1",
        title: "My Secret 1",
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
      },
      {
        id: "secret-2",
        title: "My Secret 2",
        created_at: "2025-01-01",
        updated_at: "2025-01-01",
      },
    ]);

    // Mock getSecretMasterKey to return a valid CryptoKey
    const mockKey = await crypto.subtle.generateKey(
      { name: "AES-GCM", length: 256 },
      true,
      ["encrypt", "decrypt"]
    );
    vi.mocked(secretApi.getSecretMasterKey).mockResolvedValue(mockKey);

    // Mock addFileToQueue
    vi.mocked(fileQueue.addFileToQueue).mockResolvedValue("file-123");

    // Mock processEncryptedFileQueue
    vi.mocked(fileQueue.processEncryptedFileQueue).mockResolvedValue({
      total: 1,
      completed: 1,
      failed: 0,
      pending: 0,
      skipped: 0,
    });

    // Set up shared files in sessionStorage
    sessionStorage.setItem(
      "share-target-files",
      JSON.stringify([
        {
          name: "test.jpg",
          type: "image/jpeg",
          size: 1024,
          dataUrl: "data:image/jpeg;base64,test",
        },
      ])
    );

    // Set URL parameters
    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost/?title=Test",
        search: "?title=Test",
      },
      writable: true,
    });
  });

  afterEach(() => {
    if (originalServiceWorkerDescriptor) {
      Object.defineProperty(
        navigator,
        "serviceWorker",
        originalServiceWorkerDescriptor
      );
      return;
    }

    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("should load and display secrets in selector", async () => {
    render(<ShareTarget />, { wrapper: Wrapper });

    // Wait for secrets to load
    await waitFor(() => {
      expect(secretApi.fetchSecrets).toHaveBeenCalled();
    });

    // Check if selector exists with options
    const selector = await screen.findByRole("combobox");
    expect(selector).toBeInTheDocument();

    // Check options are present
    expect(
      screen.getByRole("option", { name: /my secret 1/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: /my secret 2/i })
    ).toBeInTheDocument();
  });

  it("should enable upload button when secret is selected", async () => {
    const user = userEvent.setup();
    render(<ShareTarget />, { wrapper: Wrapper });

    // Initially button should be disabled
    const uploadBtn = await screen.findByRole("button", {
      name: /save to secret/i,
    });
    expect(uploadBtn).toBeDisabled();

    // Select a secret
    const selector = await screen.findByRole("combobox");
    await user.selectOptions(selector, "secret-1");

    // Button should now be enabled
    await waitFor(() => {
      expect(uploadBtn).toBeEnabled();
    });
  });

  it("should add files to queue and process upload when clicked", async () => {
    const user = userEvent.setup();
    render(<ShareTarget />, { wrapper: Wrapper });

    // Select secret
    const selector = await screen.findByRole("combobox");
    await user.selectOptions(selector, "secret-1");

    // Click upload button
    const uploadBtn = await screen.findByRole("button", {
      name: /save to secret/i,
    });
    await user.click(uploadBtn);

    // Wait for encryption to complete and upload to be processed
    await waitFor(
      () => {
        expect(fileQueue.addFileToQueue).toHaveBeenCalled();
        expect(fileQueue.processEncryptedFileQueue).toHaveBeenCalled();
      },
      { timeout: 5000 }
    );

    // Verify the call was made with encrypted blob
    expect(fileQueue.addFileToQueue).toHaveBeenCalledWith(
      expect.any(Blob), // Encrypted blob
      expect.objectContaining({
        name: "test.jpg",
        type: "image/jpeg",
        size: 1024, // Original plaintext size
      }),
      "secret-1"
    );
  });

  it("should show upload progress during upload", async () => {
    let resolveUpload:
      | ((value: {
          total: number;
          completed: number;
          failed: number;
          pending: number;
          skipped: number;
        }) => void)
      | undefined;

    vi.mocked(fileQueue.processEncryptedFileQueue).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
    );

    const user = userEvent.setup();
    render(<ShareTarget />, { wrapper: Wrapper });

    // Select and upload
    const selector = await screen.findByRole("combobox");
    await user.selectOptions(selector, "secret-1");

    const uploadBtn = await screen.findByRole("button", {
      name: /save to secret/i,
    });
    await user.click(uploadBtn);

    // Check progress indicator appears
    await waitFor(() => {
      expect(screen.getByText(/uploading/i)).toBeInTheDocument();
    });

    await act(async () => {
      resolveUpload?.({
        total: 1,
        completed: 1,
        failed: 0,
        pending: 0,
        skipped: 0,
      });
    });

    // Wait for completion
    await waitFor(
      () => {
        expect(screen.queryByText(/uploading/i)).not.toBeInTheDocument();
      },
      { timeout: 5000 }
    );
  });

  it("should show success message after upload", async () => {
    const user = userEvent.setup();
    render(<ShareTarget />, { wrapper: Wrapper });

    // Upload flow
    const selector = await screen.findByRole("combobox");
    await user.selectOptions(selector, "secret-1");
    const uploadBtn = await screen.findByRole("button", {
      name: /save to secret/i,
    });
    await user.click(uploadBtn);

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText(/successfully uploaded/i)).toBeInTheDocument();
    });
  });

  it("should handle upload errors gracefully", async () => {
    // Mock upload failure
    vi.mocked(fileQueue.processEncryptedFileQueue).mockResolvedValue({
      total: 1,
      completed: 0,
      failed: 1,
      pending: 0,
      skipped: 0,
    });

    const user = userEvent.setup();
    render(<ShareTarget />, { wrapper: Wrapper });

    // Upload flow
    const selector = await screen.findByRole("combobox");
    await user.selectOptions(selector, "secret-1");

    const uploadBtn = await screen.findByRole("button", {
      name: /save to secret/i,
    });
    await user.click(uploadBtn);

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText(/failed to upload/i)).toBeInTheDocument();
    });
  });

  it("should show loading state while fetching secrets", async () => {
    // Mock slow API
    vi.mocked(secretApi.fetchSecrets).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve([
                {
                  id: "secret-1",
                  title: "My Secret",
                  created_at: "2025-01-01",
                  updated_at: "2025-01-01",
                },
              ]),
            100
          )
        )
    );

    render(<ShareTarget />, { wrapper: Wrapper });

    // Should show loading state
    expect(await screen.findByText(/loading secrets/i)).toBeInTheDocument();

    // Wait for secrets to load
    await waitFor(
      () => {
        expect(screen.queryByText(/loading secrets/i)).not.toBeInTheDocument();
      },
      { timeout: 200 }
    );
  });

  it("should display error when secrets fail to load", async () => {
    // Mock API error
    vi.mocked(secretApi.fetchSecrets).mockRejectedValue(
      new Error("Network error")
    );

    render(<ShareTarget />, { wrapper: Wrapper });

    // Should show secrets loading error
    expect(
      await screen.findByText(/failed to load secrets/i)
    ).toBeInTheDocument();

    // Upload button should not be visible
    expect(
      screen.queryByRole("button", { name: /save to secret/i })
    ).not.toBeInTheDocument();
  });

  it("should handle missing dataUrl in files", async () => {
    // Mock shared data with file missing dataUrl
    sessionStorage.setItem(
      "share-target-files",
      JSON.stringify([
        {
          name: "test.jpg",
          type: "image/jpeg",
          size: 1024,
          // dataUrl is missing
        },
      ])
    );

    const user = userEvent.setup();
    render(<ShareTarget />, { wrapper: Wrapper });

    const selector = await screen.findByRole("combobox");
    await user.selectOptions(selector, "secret-1");

    const uploadBtn = await screen.findByRole("button", {
      name: /save to secret/i,
    });
    await user.click(uploadBtn);

    // Should show error about missing dataUrl
    await waitFor(() => {
      expect(
        screen.getByText(/file test\.jpg has no data url/i)
      ).toBeInTheDocument();
    });
  });

  it("should handle failed file fetch", async () => {
    // Mock fetch to fail
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });
    vi.stubGlobal("fetch", mockFetch);

    const user = userEvent.setup();
    render(<ShareTarget />, { wrapper: Wrapper });

    const selector = await screen.findByRole("combobox");
    await user.selectOptions(selector, "secret-1");

    const uploadBtn = await screen.findByRole("button", {
      name: /save to secret/i,
    });
    await user.click(uploadBtn);

    // Should show error about failed fetch
    await waitFor(() => {
      expect(
        screen.getByText(/failed to fetch file data for test\.jpg/i)
      ).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it("should handle partial upload completion", async () => {
    vi.mocked(fileQueue.processEncryptedFileQueue).mockResolvedValue({
      total: 3,
      completed: 1,
      failed: 0,
      pending: 2,
      skipped: 0,
    });

    const user = userEvent.setup();
    render(<ShareTarget />, { wrapper: Wrapper });

    const selector = await screen.findByRole("combobox");
    await user.selectOptions(selector, "secret-1");

    const uploadBtn = await screen.findByRole("button", {
      name: /save to secret/i,
    });
    await user.click(uploadBtn);

    // Should show incomplete message
    await waitFor(() => {
      expect(
        screen.getByText(/upload incomplete.*1 succeeded.*2 pending/i)
      ).toBeInTheDocument();
    });
  });

  it("does not report success when no encrypted uploads were processed", async () => {
    vi.mocked(fileQueue.processEncryptedFileQueue).mockResolvedValue({
      total: 0,
      completed: 0,
      failed: 0,
      pending: 0,
      skipped: 0,
    });

    const user = userEvent.setup();
    render(<ShareTarget />, { wrapper: Wrapper });

    const selector = await screen.findByRole("combobox");
    await user.selectOptions(selector, "secret-1");

    const uploadBtn = await screen.findByRole("button", {
      name: /save to secret/i,
    });
    await user.click(uploadBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/upload incomplete.*0 succeeded.*0 pending/i)
      ).toBeInTheDocument();
    });
  });

  it("requests shared files from the service worker and uploads File objects without dataUrl", async () => {
    const { serviceWorker, listeners } = setupServiceWorkerMock();

    Object.defineProperty(window, "location", {
      value: {
        href: "http://localhost/share?title=Test&share_id=share-123",
        pathname: "/share",
        search: "?title=Test&share_id=share-123",
      },
      writable: true,
      configurable: true,
    });

    const user = userEvent.setup();
    render(<ShareTarget />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(serviceWorker.controller.postMessage).toHaveBeenCalledWith({
        type: "REQUEST_SHARE_TARGET_FILES",
        shareId: "share-123",
      });
    });

    const sharedFile = new File(["pdf-binary"], "handoff.pdf", {
      type: "application/pdf",
    });

    await act(async () => {
      listeners.forEach((listener) =>
        listener(
          new MessageEvent("message", {
            data: {
              type: "SHARE_TARGET_FILES",
              shareId: "share-123",
              files: [
                {
                  name: "handoff.pdf",
                  type: "application/pdf",
                  size: sharedFile.size,
                  file: sharedFile,
                },
              ],
            },
          })
        )
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/handoff\.pdf/i)).toBeInTheDocument();
    });

    const selector = await screen.findByRole("combobox");
    await user.selectOptions(selector, "secret-1");

    const uploadBtn = await screen.findByRole("button", {
      name: /save to secret/i,
    });
    await user.click(uploadBtn);

    await waitFor(() => {
      expect(fileQueue.addFileToQueue).toHaveBeenCalled();
      expect(fileQueue.processEncryptedFileQueue).toHaveBeenCalled();
    });
  });

  it("rejects non-local file URLs before fetching shared file data", async () => {
    const user = userEvent.setup();

    sessionStorage.setItem(
      "share-target-files",
      JSON.stringify([
        {
          name: "handoff.pdf",
          type: "application/pdf",
          size: 1024,
          dataUrl: "https://attacker.example/file.pdf",
        },
      ])
    );

    render(<ShareTarget />, { wrapper: Wrapper });

    const selector = await screen.findByRole("combobox");
    await user.selectOptions(selector, "secret-1");

    const uploadBtn = await screen.findByRole("button", {
      name: /save to secret/i,
    });
    await user.click(uploadBtn);

    await waitFor(() => {
      expect(
        screen.getByText(/invalid local file url and cannot be uploaded/i)
      ).toBeInTheDocument();
    });

    expect(fileQueue.addFileToQueue).not.toHaveBeenCalled();
    expect(fileQueue.processEncryptedFileQueue).not.toHaveBeenCalled();
  });
});
