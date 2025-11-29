// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SecretEdit } from "./SecretEdit";
import * as secretApi from "../../services/secretApi";

// Mock the secretApi module
vi.mock("../../services/secretApi");

// Mock useNavigate and useParams
const mockNavigate = vi.fn();
const mockParams = { id: "test-id-123" };

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => mockParams,
  };
});

// Helper to render with all required providers
const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{component}</MemoryRouter>
    </I18nProvider>
  );
};

describe("SecretEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mockParams.id to default value before each test
    mockParams.id = "test-id-123";
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

    renderWithProviders(<SecretEdit />);

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

    renderWithProviders(<SecretEdit />);

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
        url: "",
        notes: "",
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

    renderWithProviders(<SecretEdit />);

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

    renderWithProviders(<SecretEdit />);

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByLabelText(/^title/i)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/secrets/test-id-123");
  });

  it("should display error when loading fails", async () => {
    const mockGetSecretById = vi.mocked(secretApi.getSecretById);
    mockGetSecretById.mockRejectedValue(new Error("Network error"));

    renderWithProviders(<SecretEdit />);

    await waitFor(() => {
      expect(screen.getByText(/failed to load secret/i)).toBeInTheDocument();
    });
  });

  it("should display 422 validation errors on update", async () => {
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

    const validationError = Object.assign(new Error("Validation failed"), {
      status: 422,
      errors: {
        url: ["Invalid URL format"],
      },
    });
    mockUpdateSecret.mockRejectedValue(validationError);

    renderWithProviders(<SecretEdit />);

    // Wait for form to load
    await waitFor(() => {
      expect(screen.getByLabelText(/^title/i)).toHaveValue("Test Secret");
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() => {
      expect(screen.getByText(/url: Invalid URL format/i)).toBeInTheDocument();
    });
  });

  it("should handle missing ID gracefully", () => {
    // Mock useParams to return no ID
    vi.mocked(secretApi.getSecretById).mockResolvedValue(
      {} as secretApi.SecretDetail
    );

    // Temporarily override mockParams
    const originalParams = mockParams.id;
    // @ts-expect-error - Testing missing ID scenario
    mockParams.id = undefined;

    renderWithProviders(<SecretEdit />);

    expect(screen.getByText(/Secret ID is missing/i)).toBeInTheDocument();

    // Restore
    mockParams.id = originalParams;
  });

  it("should not send empty password on update", async () => {
    const mockSecret: secretApi.SecretDetail = {
      id: "test-id-123",
      title: "Test Secret",
      username: "user@example.com",
      url: undefined,
      notes: undefined,
      tags: [],
      expires_at: undefined,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);
    vi.mocked(secretApi.updateSecret).mockResolvedValue(mockSecret);

    renderWithProviders(<SecretEdit />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Secret")).toBeInTheDocument();
    });

    // Submit without changing password (empty string should not be sent)
    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() => {
      expect(vi.mocked(secretApi.updateSecret)).toHaveBeenCalledWith(
        "test-id-123",
        expect.objectContaining({
          title: "Test Secret",
          username: "user@example.com",
        })
      );
    });

    // Password should NOT be in the update data
    const updateCall = vi.mocked(secretApi.updateSecret).mock.calls[0];
    expect(updateCall).toBeDefined();
    expect(updateCall![1]).not.toHaveProperty("password");
  });

  it("should handle non-ApiError with validation format on update", async () => {
    const mockSecret: secretApi.SecretDetail = {
      id: "test-id-123",
      title: "Test Secret",
      username: undefined,
      url: undefined,
      notes: undefined,
      tags: [],
      expires_at: undefined,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(secretApi.getSecretById).mockResolvedValue(mockSecret);
    vi.mocked(secretApi.updateSecret).mockRejectedValue({
      status: 422,
      errors: {
        title: ["Title is required"],
      },
    });

    renderWithProviders(<SecretEdit />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Test Secret")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /update/i }));

    await waitFor(() => {
      expect(screen.getByText(/title: Title is required/i)).toBeInTheDocument();
    });
  });
});
