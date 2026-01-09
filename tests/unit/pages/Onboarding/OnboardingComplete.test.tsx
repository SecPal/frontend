// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OnboardingComplete } from "../../../../src/pages/Onboarding/OnboardingComplete";
import * as onboardingApi from "../../../../src/services/onboardingApi";
import { AuthProvider } from "../../../../src/contexts/AuthContext";

// Mock the API
vi.mock("../../../../src/services/onboardingApi");

// Mock AuthContext
const mockLogin = vi.fn();
vi.mock("../../../../src/hooks/useAuth", () => ({
  useAuth: () => ({
    login: mockLogin,
    logout: vi.fn(),
    user: null,
    isAuthenticated: false,
    isLoading: false,
    hasRole: vi.fn(),
    hasPermission: vi.fn(),
    hasOrganizationalAccess: vi.fn(),
  }),
}));

// Wrapper to provide all required contexts
function renderWithProviders(ui: React.ReactElement, route?: string) {
  const initialEntries = route ? [route] : ["/onboarding/complete"];
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={initialEntries}>
        <AuthProvider>{ui}</AuthProvider>
      </MemoryRouter>
    </I18nProvider>
  );
}

describe("OnboardingComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders form with all required fields", () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^password\s*\*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/profile photo/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /complete account setup/i })
    ).toBeInTheDocument();
  });

  it("shows error if token or email missing", () => {
    renderWithProviders(<OnboardingComplete />, "/onboarding/complete");

    expect(screen.getByText(/invalid onboarding link/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /go to login/i })
    ).toBeInTheDocument();
  });

  it("validates required fields on submit", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    const submitButton = screen.getByRole("button", {
      name: /complete account setup/i,
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/first name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/last name is required/i)).toBeInTheDocument();
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });

    expect(onboardingApi.completeOnboarding).not.toHaveBeenCalled();
  });

  it("validates password minimum length (8 characters)", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const passwordInput = document.querySelector('input[name="password"]')!;
    const submitButton = screen.getByRole("button", {
      name: /complete account setup/i,
    });

    fireEvent.change(firstNameInput, { target: { value: "John" } });
    fireEvent.change(lastNameInput, { target: { value: "Doe" } });
    fireEvent.change(passwordInput, { target: { value: "short" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/at least 8 characters/i)).toBeInTheDocument();
    });

    expect(onboardingApi.completeOnboarding).not.toHaveBeenCalled();
  });

  it("validates password confirmation match", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const passwordInput = document.querySelector('input[name="password"]')!;
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole("button", {
      name: /complete account setup/i,
    });

    fireEvent.change(firstNameInput, { target: { value: "John" } });
    fireEvent.change(lastNameInput, { target: { value: "Doe" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.change(confirmPasswordInput, { target: { value: "different" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });

    expect(onboardingApi.completeOnboarding).not.toHaveBeenCalled();
  });

  it("validates photo file size (max 2MB)", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    const largeFile = new File(["a".repeat(3 * 1024 * 1024)], "photo.jpg", {
      type: "image/jpeg",
    });

    const photoInput = screen.getByLabelText(/profile photo/i);
    Object.defineProperty(photoInput, "files", {
      value: [largeFile],
      writable: false,
    });

    fireEvent.change(photoInput);

    await waitFor(() => {
      expect(screen.getByText(/smaller than 2MB/i)).toBeInTheDocument();
    });
  });

  it("validates photo file type (images only)", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    const pdfFile = new File(["test"], "document.pdf", {
      type: "application/pdf",
    });

    const photoInput = screen.getByLabelText(/profile photo/i);
    Object.defineProperty(photoInput, "files", {
      value: [pdfFile],
      writable: false,
    });

    fireEvent.change(photoInput);

    await waitFor(() => {
      expect(screen.getByText(/file must be an image/i)).toBeInTheDocument();
    });
  });

  it("successfully completes onboarding with valid data", async () => {
    const mockResponse = {
      message: "Onboarding completed successfully",
      data: {
        token: "test-sanctum-token",
        user: {
          id: 1,
          email: "john@example.com",
          name: "John Doe",
        },
        employee: {
          id: 1,
          first_name: "John",
          last_name: "Doe",
          status: "pre_contract",
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockResolvedValue(mockResponse);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const passwordInput = document.querySelector('input[name="password"]')!;
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole("button", {
      name: /complete account setup/i,
    });

    fireEvent.change(firstNameInput, { target: { value: "John" } });
    fireEvent.change(lastNameInput, { target: { value: "Doe" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: "password123" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onboardingApi.completeOnboarding).toHaveBeenCalledWith({
        token: "abc",
        email: "test@example.com",
        first_name: "John",
        last_name: "Doe",
        password: "password123",
        password_confirmation: "password123",
      });
    });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        id: 1,
        email: "john@example.com",
        name: "John Doe",
      });
    });
  });

  it("handles API error (invalid token)", async () => {
    const mockError = {
      response: {
        status: 422,
        data: {
          message: "Invalid or expired onboarding link",
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=invalid&email=test@example.com"
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const passwordInput = document.querySelector('input[name="password"]')!;
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole("button", {
      name: /complete account setup/i,
    });

    fireEvent.change(firstNameInput, { target: { value: "John" } });
    fireEvent.change(lastNameInput, { target: { value: "Doe" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: "password123" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/invalid or expired onboarding link/i)
      ).toBeInTheDocument();
    });

    expect(mockLogin).not.toHaveBeenCalled();
  });

  it("handles API error (rate limiting 429)", async () => {
    const mockError = {
      response: {
        status: 429,
        data: {
          message: "Too many requests",
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const passwordInput = document.querySelector('input[name="password"]')!;
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole("button", {
      name: /complete account setup/i,
    });

    fireEvent.change(firstNameInput, { target: { value: "John" } });
    fireEvent.change(lastNameInput, { target: { value: "Doe" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: "password123" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    });
  });

  it("handles API validation errors from backend", async () => {
    const mockError = {
      response: {
        status: 422,
        data: {
          message: "The given data was invalid.",
          errors: {
            first_name: ["The first name field is required."],
            password: ["The password must be at least 8 characters."],
          },
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const passwordInput = document.querySelector('input[name="password"]')!;
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole("button", {
      name: /complete account setup/i,
    });

    fireEvent.change(firstNameInput, { target: { value: " " } });
    fireEvent.change(lastNameInput, { target: { value: "Doe" } });
    fireEvent.change(passwordInput, { target: { value: "short" } });
    fireEvent.change(confirmPasswordInput, { target: { value: "short" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText(/the given data was invalid/i)
      ).toBeInTheDocument();
    });
  });
});
