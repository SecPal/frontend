// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { SecretCreate } from "./SecretCreate";
import * as secretApi from "../../services/secretApi";

// Mock the secretApi module
vi.mock("../../services/secretApi");

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
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

describe("SecretCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render create form", () => {
    renderWithProviders(<SecretCreate />);

    expect(screen.getByText(/create secret/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^title/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create/i })).toBeInTheDocument();
  });

  it("should create secret and navigate on success", async () => {
    const mockCreateSecret = vi.mocked(secretApi.createSecret);
    mockCreateSecret.mockResolvedValue({
      id: "test-id-123",
      title: "New Secret",
      username: "user@example.com",
      password: undefined,
      url: undefined,
      notes: undefined,
      tags: [],
      expires_at: undefined,
      created_at: "2025-11-22T10:00:00Z",
      updated_at: "2025-11-22T10:00:00Z",
    });

    renderWithProviders(<SecretCreate />);

    // Fill in form
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: "New Secret" },
    });
    fireEvent.change(screen.getByLabelText(/^username/i), {
      target: { value: "user@example.com" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(mockCreateSecret).toHaveBeenCalledWith({
        title: "New Secret",
        username: "user@example.com",
        password: undefined,
        url: undefined,
        notes: undefined,
        tags: undefined,
        expires_at: undefined,
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/secrets/test-id-123");
  });

  it("should display error on create failure", async () => {
    const mockCreateSecret = vi.mocked(secretApi.createSecret);
    mockCreateSecret.mockRejectedValue(new Error("Server error"));

    renderWithProviders(<SecretCreate />);

    // Fill in form
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: "Test Secret" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText(/unexpected error/i)).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should display 422 validation errors", async () => {
    const mockCreateSecret = vi.mocked(secretApi.createSecret);
    const validationError = Object.assign(new Error("Validation failed"), {
      status: 422,
      errors: {
        title: ["Title is too long"],
        url: ["Invalid URL format"],
      },
    });
    mockCreateSecret.mockRejectedValue(validationError);

    renderWithProviders(<SecretCreate />);

    // Fill in form
    fireEvent.change(screen.getByLabelText(/^title/i), {
      target: { value: "Test Secret" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/title: Title is too long; url: Invalid URL format/i)
      ).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should navigate to secrets list on cancel", () => {
    renderWithProviders(<SecretCreate />);

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/secrets");
  });

  it("should handle non-ApiError with validation format on create", async () => {
    const mockCreateSecret = vi.mocked(secretApi.createSecret);
    mockCreateSecret.mockRejectedValueOnce({
      status: 422,
      errors: {
        title: ["Title is required"],
        url: ["Invalid URL format"],
      },
    });

    renderWithProviders(<SecretCreate />);

    // Fill in form
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: "Test" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByText(/title: Title is required/i)).toBeInTheDocument();
    });
  });
});
