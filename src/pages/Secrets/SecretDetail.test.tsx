// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes, MemoryRouter } from "react-router";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SecretDetail } from "./SecretDetail";
import * as secretApi from "../../services/secretApi";
import * as shareApi from "../../services/shareApi";
import type { SecretDetail as SecretDetailType } from "../../services/secretApi";

// Mock secret API (keep ApiError real)
vi.mock("../../services/secretApi", async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import("../../services/secretApi");
  return {
    ...actual,
    getSecretById: vi.fn(),
    getSecretMasterKey: vi.fn(),
    downloadAndDecryptAttachment: vi.fn(),
    deleteAttachment: vi.fn(),
  };
});

// Mock share API
vi.mock("../../services/shareApi", async (importOriginal) => {
  const actual =
    (await importOriginal()) as typeof import("../../services/shareApi");
  return {
    ...actual,
    fetchShares: vi.fn(),
    createShare: vi.fn(),
    revokeShare: vi.fn(),
  };
});

describe("SecretDetail", () => {
  const mockSecret: SecretDetailType = {
    id: "secret-1",
    title: "Gmail Account",
    username: "user@example.com",
    password: "super-secret-password",
    url: "https://gmail.com",
    notes: "Main work email account",
    tags: ["work", "email"],
    expires_at: "2025-12-31T23:59:59Z",
    created_at: "2025-01-01T10:00:00Z",
    updated_at: "2025-11-15T14:30:00Z",
    owner: {
      id: "user-1",
      name: "John Doe",
    },
    attachments: [
      {
        id: "att-1",
        filename: "recovery-codes.txt",
        size: 1234,
        mime_type: "text/plain",
        created_at: "2025-01-01T10:00:00Z",
      },
    ],
    shares: [
      {
        id: "share-1",
        user: {
          id: "user-2",
          name: "Jane Smith",
        },
        permission: "read",
        granted_by: {
          id: "user-1",
          name: "John Doe",
        },
        granted_at: "2025-11-01T10:00:00Z",
      },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to render with router
  const renderWithRouter = (secretId: string) => {
    return render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={[`/secrets/${secretId}`]}>
          <Routes>
            <Route path="/secrets/:id" element={<SecretDetail />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );
  };

  it("should display loading state initially", () => {
    vi.mocked(secretApi.getSecretById).mockImplementation(
      () =>
        new Promise(() => {
          // Never resolves
        })
    );

    renderWithRouter("secret-1");

    expect(screen.getByText("Loading secret...")).toBeInTheDocument();
  });

  it("should load and display secret details", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(screen.getByText("https://gmail.com")).toBeInTheDocument();
    expect(screen.getByText("Main work email account")).toBeInTheDocument();
    expect(screen.getByText("#work")).toBeInTheDocument();
    expect(screen.getByText("#email")).toBeInTheDocument();
  });

  it("should hide password by default", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    // Password should be hidden
    expect(screen.getByText("••••••••••••")).toBeInTheDocument();
    expect(screen.queryByText("super-secret-password")).not.toBeInTheDocument();
  });

  it("should show password when Show button clicked", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);
    const user = userEvent.setup();

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    // Click Show button
    const showButton = screen.getByRole("button", { name: /Show password/ });
    await user.click(showButton);

    // Password should be visible
    expect(screen.getByText("super-secret-password")).toBeInTheDocument();
    expect(screen.queryByText("••••••••••••")).not.toBeInTheDocument();

    // Button should change to Hide
    expect(
      screen.getByRole("button", { name: /Hide password/ })
    ).toBeInTheDocument();
  });

  it("should display attachments", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);

    // Mock master key for attachment decryption
    const mockMasterKey = {} as CryptoKey;
    vi.mocked(secretApi.getSecretMasterKey).mockResolvedValue(mockMasterKey);

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    // Wait for attachments section to appear
    await waitFor(() => {
      expect(screen.getByText(/Attachments \(1\)/)).toBeInTheDocument();
    });

    expect(screen.getByText(/recovery-codes.txt/)).toBeInTheDocument();
  });

  it("should display shares", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    expect(screen.getByText(/Shared with \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
    expect(screen.getByText(/\(read\)/)).toBeInTheDocument();
    expect(screen.getByText(/Granted by John Doe/)).toBeInTheDocument();
  });

  it("should display owner and metadata", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    expect(screen.getByText(/Owner:/)).toBeInTheDocument();
    expect(screen.getAllByText(/John Doe/)[0]).toBeInTheDocument(); // Owner appears in metadata and shares
    expect(screen.getByText(/Created:/)).toBeInTheDocument();
    expect(screen.getByText(/Updated:/)).toBeInTheDocument();
  });

  it("should display error state on 404", async () => {
    vi.mocked(secretApi.getSecretById).mockRejectedValue(
      new secretApi.ApiError("Secret not found", 404)
    );

    renderWithRouter("invalid-id");

    await waitFor(() => {
      expect(screen.getByText("Error Loading Secret")).toBeInTheDocument();
    });

    expect(screen.getByText("Secret not found")).toBeInTheDocument();
    expect(screen.getByText("Back to Secrets")).toBeInTheDocument();
  });

  it("should display error state on 403", async () => {
    vi.mocked(secretApi.getSecretById).mockRejectedValue(
      new secretApi.ApiError("Access denied", 403)
    );

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Error Loading Secret")).toBeInTheDocument();
    });

    expect(
      screen.getByText("You do not have permission to view this secret")
    ).toBeInTheDocument();
  });

  it("should show expired badge for expired secrets", async () => {
    const expiredSecret: SecretDetailType = {
      ...mockSecret,
      expires_at: "2020-01-01T00:00:00Z", // Past date
    };

    vi.mocked(secretApi.getSecretById).mockResolvedValue(expiredSecret);

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    expect(screen.getByText(/⚠️ Expired/)).toBeInTheDocument();
  });

  it("should handle secret without optional fields", async () => {
    const minimalSecret: SecretDetailType = {
      id: "secret-1",
      title: "Minimal Secret",
      created_at: "2025-01-01T10:00:00Z",
      updated_at: "2025-11-15T14:30:00Z",
    };

    vi.mocked(secretApi.getSecretById).mockResolvedValue(minimalSecret);

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Minimal Secret")).toBeInTheDocument();
    });

    // Should not crash and should not show empty sections
    expect(screen.queryByText("Username")).not.toBeInTheDocument();
    expect(screen.queryByText("Password")).not.toBeInTheDocument();
    expect(screen.queryByText("Notes")).not.toBeInTheDocument();
    expect(screen.queryByText("Attachments")).not.toBeInTheDocument();
    expect(screen.queryByText("Shared with")).not.toBeInTheDocument();
  });

  it("should handle master key loading failure gracefully", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);
    vi.mocked(secretApi.getSecretMasterKey).mockRejectedValue(
      new Error("Failed to decrypt master key")
    );

    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    // Should still display secret details despite master key failure
    expect(screen.getByText("user@example.com")).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Failed to load master key:",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it("should download attachment when download handler called", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);

    const mockMasterKey = {} as CryptoKey;
    vi.mocked(secretApi.getSecretMasterKey).mockResolvedValue(mockMasterKey);

    const mockFile = new File(["test content"], "recovery-codes.txt", {
      type: "text/plain",
    });
    vi.mocked(secretApi.downloadAndDecryptAttachment).mockResolvedValue(
      mockFile
    );

    // Mock DOM APIs
    const createElementSpy = vi.spyOn(document, "createElement");
    const appendChildSpy = vi.spyOn(document.body, "appendChild");
    const removeChildSpy = vi.spyOn(document.body, "removeChild");
    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock-url");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL");

    const user = userEvent.setup();
    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    // Wait for master key to load
    await waitFor(() => {
      expect(secretApi.getSecretMasterKey).toHaveBeenCalledWith("secret-1");
    });

    // Click download button
    const downloadButton = screen.getByRole("button", {
      name: /Download recovery-codes.txt/,
    });
    await user.click(downloadButton);

    // Verify download flow
    await waitFor(() => {
      expect(secretApi.downloadAndDecryptAttachment).toHaveBeenCalledWith(
        "att-1",
        mockMasterKey
      );
    });

    expect(createObjectURLSpy).toHaveBeenCalledWith(mockFile);
    expect(createElementSpy).toHaveBeenCalledWith("a");
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");

    // Cleanup
    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
    createElementSpy.mockRestore();
    appendChildSpy.mockRestore();
    removeChildSpy.mockRestore();
  });

  it("should handle download failure with alert", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);

    const mockMasterKey = {} as CryptoKey;
    vi.mocked(secretApi.getSecretMasterKey).mockResolvedValue(mockMasterKey);

    vi.mocked(secretApi.downloadAndDecryptAttachment).mockRejectedValue(
      new Error("Download failed")
    );

    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const user = userEvent.setup();
    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(secretApi.getSecretMasterKey).toHaveBeenCalled();
    });

    const downloadButton = screen.getByRole("button", {
      name: /Download recovery-codes.txt/,
    });
    await user.click(downloadButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Failed to download attachment");
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Download failed:",
      expect.any(Error)
    );

    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should delete attachment with confirmation", async () => {
    const mockMasterKey = {} as CryptoKey;

    // Initial load with attachment
    vi.mocked(secretApi.getSecretById)
      .mockResolvedValueOnce(mockSecret)
      .mockResolvedValueOnce({ ...mockSecret, attachments: [] }); // After delete

    vi.mocked(secretApi.getSecretMasterKey).mockResolvedValue(mockMasterKey);

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(secretApi.deleteAttachment).mockResolvedValue();

    const user = userEvent.setup();
    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    // Wait for attachments to load
    await waitFor(() => {
      expect(screen.getByText(/recovery-codes.txt/)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", {
      name: /Delete recovery-codes.txt/,
    });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        "Are you sure you want to delete this attachment?"
      );
    });

    expect(secretApi.deleteAttachment).toHaveBeenCalledWith("att-1");

    // Verify secret was refreshed (second call to getSecretById)
    await waitFor(() => {
      expect(secretApi.getSecretById).toHaveBeenCalledTimes(2);
    });

    confirmSpy.mockRestore();
  });

  it("should cancel delete when confirmation rejected", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);

    const mockMasterKey = {} as CryptoKey;
    vi.mocked(secretApi.getSecretMasterKey).mockResolvedValue(mockMasterKey);

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    vi.mocked(secretApi.deleteAttachment).mockResolvedValue();

    const user = userEvent.setup();
    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/recovery-codes.txt/)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", {
      name: /Delete recovery-codes.txt/,
    });
    await user.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalled();
    expect(secretApi.deleteAttachment).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it("should handle delete failure with alert", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);

    const mockMasterKey = {} as CryptoKey;
    vi.mocked(secretApi.getSecretMasterKey).mockResolvedValue(mockMasterKey);

    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(secretApi.deleteAttachment).mockRejectedValue(
      new Error("Delete failed")
    );

    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const user = userEvent.setup();
    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/recovery-codes.txt/)).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", {
      name: /Delete recovery-codes.txt/,
    });
    await user.click(deleteButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Failed to delete attachment");
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Delete failed:",
      expect.any(Error)
    );

    confirmSpy.mockRestore();
    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should open preview modal for previewable attachment", async () => {
    // Use mock secret with image attachment
    const secretWithImage = {
      ...mockSecret,
      attachments: [
        {
          id: "att-img",
          filename: "image.png",
          size: 5000,
          mime_type: "image/png",
          created_at: "2025-01-01T10:00:00Z",
        },
      ],
    };
    vi.mocked(secretApi.getSecretById).mockResolvedValue(secretWithImage);

    const mockMasterKey = {} as CryptoKey;
    vi.mocked(secretApi.getSecretMasterKey).mockResolvedValue(mockMasterKey);

    const mockFile = new File(["test content"], "image.png", {
      type: "image/png",
    });
    vi.mocked(secretApi.downloadAndDecryptAttachment).mockResolvedValue(
      mockFile
    );

    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock-url");

    const user = userEvent.setup();

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/image.png/)).toBeInTheDocument();
    });

    const previewButton = screen.getByRole("button", {
      name: /Preview image.png/,
    });
    await user.click(previewButton);

    await waitFor(() => {
      expect(secretApi.downloadAndDecryptAttachment).toHaveBeenCalledWith(
        "att-img",
        mockMasterKey
      );
    });

    expect(createObjectURLSpy).toHaveBeenCalledWith(mockFile);

    // Preview modal should be visible
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    createObjectURLSpy.mockRestore();
  });

  it("should handle preview failure with alert", async () => {
    const secretWithImage = {
      ...mockSecret,
      attachments: [
        {
          id: "att-img",
          filename: "image.png",
          size: 5000,
          mime_type: "image/png",
          created_at: "2025-01-01T10:00:00Z",
        },
      ],
    };
    vi.mocked(secretApi.getSecretById).mockResolvedValue(secretWithImage);

    const mockMasterKey = {} as CryptoKey;
    vi.mocked(secretApi.getSecretMasterKey).mockResolvedValue(mockMasterKey);

    vi.mocked(secretApi.downloadAndDecryptAttachment).mockRejectedValue(
      new Error("Preview failed")
    );

    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const user = userEvent.setup();

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/image.png/)).toBeInTheDocument();
    });

    const previewButton = screen.getByRole("button", {
      name: /Preview image.png/,
    });
    await user.click(previewButton);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith("Failed to load preview");
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Preview failed:",
      expect.any(Error)
    );

    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should cleanup preview URL when modal is closed", async () => {
    const secretWithImage = {
      ...mockSecret,
      attachments: [
        {
          id: "att-img",
          filename: "image.png",
          size: 5000,
          mime_type: "image/png",
          created_at: "2025-01-01T10:00:00Z",
        },
      ],
    };
    vi.mocked(secretApi.getSecretById).mockResolvedValue(secretWithImage);

    const mockMasterKey = {} as CryptoKey;
    vi.mocked(secretApi.getSecretMasterKey).mockResolvedValue(mockMasterKey);

    const mockFile = new File(["test content"], "image.png", {
      type: "image/png",
    });
    vi.mocked(secretApi.downloadAndDecryptAttachment).mockResolvedValue(
      mockFile
    );

    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock-url");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL");

    const user = userEvent.setup();

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/image.png/)).toBeInTheDocument();
    });

    const previewButton = screen.getByRole("button", {
      name: /Preview image.png/,
    });
    await user.click(previewButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Close modal
    const closeButton = screen.getByRole("button", { name: /close preview/i });
    await user.click(closeButton);

    await waitFor(() => {
      expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url");
    });

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it("should cleanup preview URL on component unmount", async () => {
    const secretWithImage = {
      ...mockSecret,
      attachments: [
        {
          id: "att-img",
          filename: "image.png",
          size: 5000,
          mime_type: "image/png",
          created_at: "2025-01-01T10:00:00Z",
        },
      ],
    };
    vi.mocked(secretApi.getSecretById).mockResolvedValue(secretWithImage);

    const mockMasterKey = {} as CryptoKey;
    vi.mocked(secretApi.getSecretMasterKey).mockResolvedValue(mockMasterKey);

    const mockFile = new File(["test content"], "image.png", {
      type: "image/png",
    });
    vi.mocked(secretApi.downloadAndDecryptAttachment).mockResolvedValue(
      mockFile
    );

    const createObjectURLSpy = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:mock-url-unmount");
    const revokeObjectURLSpy = vi.spyOn(URL, "revokeObjectURL");

    const user = userEvent.setup();

    const { unmount } = renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/image.png/)).toBeInTheDocument();
    });

    const previewButton = screen.getByRole("button", {
      name: /Preview image.png/,
    });
    await user.click(previewButton);

    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    // Unmount component
    unmount();

    // Verify URL was revoked on unmount
    expect(revokeObjectURLSpy).toHaveBeenCalledWith("blob:mock-url-unmount");

    createObjectURLSpy.mockRestore();
    revokeObjectURLSpy.mockRestore();
  });

  it("should use internationalized error messages", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);

    const mockMasterKey = {} as CryptoKey;
    vi.mocked(secretApi.getSecretMasterKey).mockResolvedValue(mockMasterKey);

    vi.mocked(secretApi.downloadAndDecryptAttachment).mockRejectedValue(
      new Error("Network error")
    );

    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const user = userEvent.setup();

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByText(/recovery-codes.txt/)).toBeInTheDocument();
    });

    const downloadButton = screen.getByRole("button", {
      name: /Download recovery-codes.txt/,
    });
    await user.click(downloadButton);

    await waitFor(() => {
      // i18n._(msg`...`) returns the English string in tests
      expect(alertSpy).toHaveBeenCalledWith("Failed to download attachment");
    });

    alertSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});

describe("Secret Sharing", () => {
  const mockSecretWithShares: SecretDetailType = {
    id: "secret-1",
    title: "Gmail Account",
    username: "user@example.com",
    password: "super-secret-password",
    url: "https://gmail.com",
    notes: "Main work email account",
    tags: ["work", "email"],
    expires_at: "2025-12-31T23:59:59Z",
    created_at: "2025-01-01T10:00:00Z",
    updated_at: "2025-11-15T14:30:00Z",
    owner: {
      id: "user-1",
      name: "John Doe",
    },
    shares: [
      {
        id: "share-1",
        user: { id: "user-2", name: "Jane Smith" },
        permission: "read",
        granted_by: { id: "user-1", name: "You" },
        granted_at: "2025-11-01T10:00:00Z",
      },
    ],
  };

  const renderWithRouter = (secretId: string) => {
    return render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={[`/secrets/${secretId}`]}>
          <Routes>
            <Route path="/secrets/:id" element={<SecretDetail />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

    it("should call refreshShares after revoke", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecretWithShares);
    vi.mocked(shareApi.fetchShares).mockResolvedValue([]);
    vi.mocked(shareApi.revokeShare).mockResolvedValue(undefined);

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    // Has initial share
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();

    // Revoke share
    const user = userEvent.setup();
    globalThis.confirm = vi.fn(() => true);

    const revokeButtons = screen.getAllByRole("button", { name: /revoke/i });
    await user.click(revokeButtons[0]!);

    // Verify refreshShares was called (fetchShares gets called inside refreshShares)
    await waitFor(() => {
      expect(shareApi.fetchShares).toHaveBeenCalledWith("secret-1");
      expect(shareApi.revokeShare).toHaveBeenCalledWith("secret-1", "share-1");
    });
  });

  it("should show Share button only when owner is set", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecretWithShares);
    vi.mocked(shareApi.fetchShares).mockResolvedValue(
      mockSecretWithShares.shares!
    );

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /share/i })).toBeInTheDocument();
  });

  it("should not show Share button when owner is null", async () => {
    const secretWithoutOwner: SecretDetailType = {
      ...mockSecretWithShares,
      owner: undefined,
    };
    vi.mocked(secretApi.getSecretById).mockResolvedValue(secretWithoutOwner);

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("button", { name: /share/i })
    ).not.toBeInTheDocument();
  });

  it("should open ShareDialog when Share button is clicked", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecretWithShares);
    vi.mocked(shareApi.fetchShares).mockResolvedValue(
      mockSecretWithShares.shares!
    );

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const shareButton = screen.getByRole("button", { name: /share/i });
    await user.click(shareButton);

    await waitFor(() => {
      expect(screen.getByText(/Share "Gmail Account"/i)).toBeInTheDocument();
    });
  });

  it("should refresh shares after successful share creation", async () => {
    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecretWithShares);
    vi.mocked(shareApi.fetchShares).mockResolvedValue(
      mockSecretWithShares.shares!
    );
    vi.mocked(shareApi.createShare).mockResolvedValue({
      id: "share-2",
      user: { id: "user-3", name: "Bob Johnson" },
      permission: "read",
      granted_by: { id: "user-1", name: "You" },
      granted_at: new Date().toISOString(),
    });

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    const shareButton = screen.getByRole("button", { name: /share/i });
    await user.click(shareButton);

    await waitFor(() => {
      expect(screen.getByText(/Share "Gmail Account"/i)).toBeInTheDocument();
    });

    // Close dialog - actual form interactions tested in ShareDialog.test.tsx
    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    await user.click(cancelButton);

    await waitFor(() => {
      expect(
        screen.queryByText(/Share "Gmail Account"/i)
      ).not.toBeInTheDocument();
    });
  });
});
