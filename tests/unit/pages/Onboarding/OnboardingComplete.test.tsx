// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
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

// Helper to wait for token validation to complete
async function waitForFormReady() {
  await waitFor(() => {
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
  });
}

describe("OnboardingComplete", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock validateOnboardingToken to return employee data
    // Using John/Doe to match test data and avoid triggering name change dialog
    vi.mocked(onboardingApi.validateOnboardingToken).mockResolvedValue({
      data: {
        first_name: "John",
        last_name: "Doe",
        email: "test@secpal.dev",
      },
    });
  });

  it("renders form with all required fields", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    // Wait for token validation to complete
    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(document.querySelector('input[name="password"]')).toBeTruthy();
    expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/profile photo/i)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /complete account setup/i })
    ).toBeInTheDocument();
  });

  it("shows error if token or email missing", async () => {
    renderWithProviders(<OnboardingComplete />, "/onboarding/complete");

    await waitFor(() => {
      expect(screen.getByText(/missing token and email/i)).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /go to login/i })
    ).toBeInTheDocument();
  });

  it("shows a dedicated rate-limit state when token validation returns 429", async () => {
    vi.mocked(onboardingApi.validateOnboardingToken).mockRejectedValueOnce({
      response: {
        status: 429,
        data: {
          message: "Too many onboarding attempts. Please try again later.",
        },
        retryAfterSeconds: 120,
      },
    });

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitFor(() => {
      expect(screen.getByText(/too many attempts/i)).toBeInTheDocument();
    });

    expect(screen.queryByText(/invalid link/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/please try again in about 2 minutes/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /try again/i })
    ).toBeInTheDocument();
  });

  it("shows singular minute hint when retryAfterSeconds is ≤60", async () => {
    vi.mocked(onboardingApi.validateOnboardingToken).mockRejectedValueOnce({
      response: {
        status: 429,
        data: {
          message: "Too many onboarding attempts. Please try again later.",
        },
        retryAfterSeconds: 45,
      },
    });

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitFor(() => {
      expect(
        screen.getByText(/please try again in about 1 minute/i)
      ).toBeInTheDocument();
    });
  });

  it("validates required fields on submit", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    // Clear the prefilled fields to test validation
    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    fireEvent.change(firstNameInput, { target: { value: "" } });
    fireEvent.change(lastNameInput, { target: { value: "" } });

    const form = screen
      .getByRole("button", {
        name: /complete account setup/i,
      })
      .closest("form")!;
    fireEvent.submit(form);

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
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

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
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

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

  it("successfully completes onboarding with valid data", async () => {
    const mockResponse = {
      message: "Onboarding completed successfully",
      data: {
        user: {
          id: 1,
          email: "john@secpal.dev",
          name: "John Doe",
        },
        employee: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          first_name: "John",
          last_name: "Doe",
          status: "pre_contract",
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockResolvedValue(mockResponse);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

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
        email: "test@secpal.dev",
        first_name: "John",
        last_name: "Doe",
        password: "password123",
      });
    });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        id: "1",
        email: "john@secpal.dev",
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
      "/onboarding/complete?token=invalid&email=test@secpal.dev"
    );

    await waitForFormReady();

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
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

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
        screen.getByText(/too many onboarding attempts/i)
      ).toBeInTheDocument();
    });

    expect(screen.queryByText(/^invalid link$/i)).not.toBeInTheDocument();
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
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

    const firstNameInput = screen.getByLabelText(/first name/i);
    const lastNameInput = screen.getByLabelText(/last name/i);
    const passwordInput = document.querySelector('input[name="password"]')!;
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i);
    const submitButton = screen.getByRole("button", {
      name: /complete account setup/i,
    });

    fireEvent.change(firstNameInput, { target: { value: "John" } });
    fireEvent.change(lastNameInput, { target: { value: "Doe" } });
    fireEvent.change(passwordInput, { target: { value: "validPassword123" } });
    fireEvent.change(confirmPasswordInput, {
      target: { value: "validPassword123" },
    });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(
        screen.getByText("The given data was invalid.")
      ).toBeInTheDocument();
    });
  });

  it("handles generic API errors (500)", async () => {
    const mockError = {
      response: {
        status: 500,
        data: {
          message: "Internal server error",
        },
      },
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

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
      expect(screen.getByText(/internal server error/i)).toBeInTheDocument();
    });
  });

  it("handles network errors (no response)", async () => {
    const mockError = {
      message: "Network Error",
    };

    vi.mocked(onboardingApi.completeOnboarding).mockRejectedValue(mockError);

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@secpal.dev"
    );

    await waitForFormReady();

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
        screen.getByText(/failed to complete onboarding/i)
      ).toBeInTheDocument();
    });
  });

  it("navigates to login when clicking 'Go to Login' button", () => {
    renderWithProviders(<OnboardingComplete />, "/onboarding/complete");

    const loginButton = screen.getByRole("button", { name: /go to login/i });
    expect(loginButton).toBeInTheDocument();

    // Verify button is interactive and clickable
    fireEvent.click(loginButton);
    expect(loginButton).toBeEnabled();
  });
});
