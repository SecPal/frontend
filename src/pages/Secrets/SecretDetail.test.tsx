// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router";
import { SecretDetail } from "./SecretDetail";
import * as secretApi from "../../services/secretApi";
import type { SecretDetail as SecretDetailType } from "../../services/secretApi";

// Mock secret API
vi.mock("../../services/secretApi");

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
      <BrowserRouter>
        <Routes>
          <Route path="/secrets/:id" element={<SecretDetail />} />
        </Routes>
      </BrowserRouter>,
      { route: `/secrets/${secretId}` } as never
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

    renderWithRouter("secret-1");

    await waitFor(() => {
      expect(screen.getByText("Gmail Account")).toBeInTheDocument();
    });

    expect(screen.getByText(/Attachments \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/recovery-codes.txt/)).toBeInTheDocument();
    expect(screen.getByText(/1.2 KB/)).toBeInTheDocument();
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
    expect(screen.getByText(/John Doe/)).toBeInTheDocument();
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
});
