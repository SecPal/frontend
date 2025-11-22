// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router";
import { SecretEdit } from "./SecretEdit";
import * as secretApi from "../../services/secretApi";

// Mock the secretApi module
vi.mock("../../services/secretApi");

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
const mockParams = { id: "test-id-123" };

vi.mock("react-router", async () => {
  const actual = await vi.importActual("react-router");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

describe("SecretEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should load and display existing secret", async () => {
    const mockGetSecretById = vi.mocked(secretApi.getSecretById);
    mockGetSecretById.mockResolvedValue({
      id: "test-id-123",
      title: "Existing Secret",
      username: "existing@example.com",
      password: undefined,
      url: "https://example.com",
      notes: "Some notes",
      tags: ["work"],
      expires_at: undefined,
      created_at: "2025-11-22T10:00:00Z",
      updated_at: "2025-11-22T10:00:00Z",
    });

    render(
      <BrowserRouter>
        <SecretEdit />
      </BrowserRouter>
    );

    // Should show loading initially
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Existing Secret");
    });

    expect(screen.getByLabelText(/^username/i)).toHaveValue(
      "existing@example.com"
    );
    expect(screen.getByLabelText(/^url/i)).toHaveValue("https://example.com");
    expect(screen.getByLabelText(/^notes/i)).toHaveValue("Some notes");
  });

  it("should update secret and navigate on success", async () => {
    const mockGetSecretById = vi.mocked(secretApi.getSecretById);
    const mockUpdateSecret = vi.mocked(secretApi.updateSecret);

    mockGetSecretById.mockResolvedValue({
      id: "test-id-123",
      title: "Original Title",
      username: "user@example.com",
      password: undefined,
      url: undefined,
      notes: undefined,
      tags: [],
      expires_at: undefined,
      created_at: "2025-11-22T10:00:00Z",
      updated_at: "2025-11-22T10:00:00Z",
    });

    mockUpdateSecret.mockResolvedValue({
      id: "test-id-123",
      title: "Updated Title",
      username: "user@example.com",
      password: undefined,
      url: undefined,
      notes: undefined,
      tags: [],
      expires_at: undefined,
      created_at: "2025-11-22T10:00:00Z",
      updated_at: "2025-11-22T10:30:00Z",
    });

    render(
      <BrowserRouter>
        <SecretEdit />
      </BrowserRouter>
    );

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Original Title");
    });

    // Update title
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: "Updated Title" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() => {
      expect(mockUpdateSecret).toHaveBeenCalledWith("test-id-123", {
        title: "Updated Title",
        username: "user@example.com",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/secrets/test-id-123");
  });

  it("should display error on update failure", async () => {
    const mockGetSecretById = vi.mocked(secretApi.getSecretById);
    const mockUpdateSecret = vi.mocked(secretApi.updateSecret);

    mockGetSecretById.mockResolvedValue({
      id: "test-id-123",
      title: "Test Secret",
      username: undefined,
      password: undefined,
      url: undefined,
      notes: undefined,
      tags: [],
      expires_at: undefined,
      created_at: "2025-11-22T10:00:00Z",
      updated_at: "2025-11-22T10:00:00Z",
    });

    mockUpdateSecret.mockRejectedValue(new Error("Server error"));

    render(
      <BrowserRouter>
        <SecretEdit />
      </BrowserRouter>
    );

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Test Secret");
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() => {
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    });
  });

  it("should navigate back on cancel", async () => {
    const mockGetSecretById = vi.mocked(secretApi.getSecretById);
    mockGetSecretById.mockResolvedValue({
      id: "test-id-123",
      title: "Test Secret",
      username: undefined,
      password: undefined,
      url: undefined,
      notes: undefined,
      tags: [],
      expires_at: undefined,
      created_at: "2025-11-22T10:00:00Z",
      updated_at: "2025-11-22T10:00:00Z",
    });

    render(
      <BrowserRouter>
        <SecretEdit />
      </BrowserRouter>
    );

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByLabelText(/^title/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/secrets/test-id-123");
  });
});
