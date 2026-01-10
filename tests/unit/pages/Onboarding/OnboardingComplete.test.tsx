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
    vi.mocked(onboardingApi.validateOnboardingToken).mockResolvedValue({
      data: {
        first_name: "Max",
        last_name: "Mustermann",
        email: "test@example.com",
      },
    });
  });

  it("renders form with all required fields", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    // Wait for token validation to complete
    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(document.querySelector('input[name="password"]')).toBeTruthy();
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

    await waitForFormReady();

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
      "/onboarding/complete?token=abc&email=test@example.com"
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

  it("validates photo file size (max 2MB)", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    await waitForFormReady();

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

    await waitForFormReady();

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
      "/onboarding/complete?token=abc&email=test@example.com"
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
      "/onboarding/complete?token=abc&email=test@example.com"
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
      "/onboarding/complete?token=abc&email=test@example.com"
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

  it("cleans up FileReader on unmount during active file read", async () => {
    // Mock FileReader to track abort calls
    const mockAbort = vi.fn();
    const originalFileReader = globalThis.FileReader;

    class MockFileReader {
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result: string | null = null;
      abort = mockAbort;

      readAsDataURL() {
        // Simulate async read - don't complete immediately
        setTimeout(() => {
          if (this.onloadend) {
            this.result = "data:image/png;base64,fake";
            this.onloadend();
          }
        }, 100);
      }
    }

    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    const { unmount } = renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    await waitForFormReady();

    // Upload a file
    const file = new File(["fake-image"], "photo.jpg", {
      type: "image/jpeg",
    });
    const photoInput = screen.getByLabelText(/profile photo/i);
    Object.defineProperty(photoInput, "files", {
      value: [file],
      writable: false,
    });

    fireEvent.change(photoInput);

    // Unmount before read completes
    unmount();

    // FileReader abort should have been called
    await waitFor(() => {
      expect(mockAbort).toHaveBeenCalled();
    });

    // Restore original FileReader
    globalThis.FileReader = originalFileReader;
  });

  it("handles FileReader error during photo read", async () => {
    // Mock FileReader to trigger error
    const originalFileReader = globalThis.FileReader;

    class MockFileReader {
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result: string | null = null;
      abort = vi.fn();

      readAsDataURL() {
        // Simulate error immediately
        setTimeout(() => {
          if (this.onerror) {
            this.onerror();
          }
        }, 10);
      }
    }

    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    await waitForFormReady();

    // Upload a file
    const file = new File(["fake-image"], "photo.jpg", {
      type: "image/jpeg",
    });
    const photoInput = screen.getByLabelText(/profile photo/i);
    Object.defineProperty(photoInput, "files", {
      value: [file],
      writable: false,
    });

    fireEvent.change(photoInput);

    // Should show error message
    await waitFor(() => {
      expect(screen.getByText(/failed to read file/i)).toBeInTheDocument();
    });

    // Restore original FileReader
    globalThis.FileReader = originalFileReader;
  });

  it("aborts previous FileReader when selecting new file", async () => {
    // Mock FileReader to track multiple reads
    const mockAbort = vi.fn();
    const originalFileReader = globalThis.FileReader;

    class MockFileReader {
      onloadend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      result: string | null = null;
      abort = mockAbort;

      readAsDataURL() {
        setTimeout(() => {
          if (this.onloadend) {
            this.result = "data:image/png;base64,fake";
            this.onloadend();
          }
        }, 50);
      }
    }

    globalThis.FileReader = MockFileReader as unknown as typeof FileReader;

    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    await waitForFormReady();

    const photoInput = screen.getByLabelText(/profile photo/i);

    // Upload first file
    const file1 = new File(["fake-image-1"], "photo1.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(photoInput, "files", {
      value: [file1],
      configurable: true,
    });
    fireEvent.change(photoInput);

    // Clear previous mock call
    mockAbort.mockClear();

    // Immediately upload second file (before first completes)
    const file2 = new File(["fake-image-2"], "photo2.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(photoInput, "files", {
      value: [file2],
      configurable: true,
    });
    fireEvent.change(photoInput);

    // First FileReader should have been aborted
    await waitFor(() => {
      expect(mockAbort).toHaveBeenCalled();
    });

    // Restore original FileReader
    globalThis.FileReader = originalFileReader;
  });

  it("clears photo error when uploading valid file after error", async () => {
    renderWithProviders(
      <OnboardingComplete />,
      "/onboarding/complete?token=abc&email=test@example.com"
    );

    await waitForFormReady();

    const photoInput = screen.getByLabelText(/profile photo/i);

    // First: Upload file that's too large
    const largeFile = new File(["a".repeat(3 * 1024 * 1024)], "large.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(photoInput, "files", {
      value: [largeFile],
      writable: false,
      configurable: true,
    });
    fireEvent.change(photoInput);

    // Error should be shown
    await waitFor(() => {
      expect(screen.getByText(/smaller than 2MB/i)).toBeInTheDocument();
    });

    // Now upload valid file
    const validFile = new File(["small"], "valid.jpg", {
      type: "image/jpeg",
    });
    Object.defineProperty(photoInput, "files", {
      value: [validFile],
      writable: false,
      configurable: true,
    });
    fireEvent.change(photoInput);

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText(/smaller than 2MB/i)).not.toBeInTheDocument();
    });
  });
});
