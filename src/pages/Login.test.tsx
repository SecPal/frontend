// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter } from "react-router-dom";
import { Login } from "./Login";
import { AuthProvider } from "../contexts/AuthContext";
import * as authApi from "../services/authApi";
import * as healthApi from "../services/healthApi";

// Mock only the API functions, not AuthApiError class
vi.mock("../services/authApi", async () => {
  const actual = await vi.importActual("../services/authApi");
  return {
    ...actual,
    login: vi.fn(),
    logout: vi.fn(),
    logoutAll: vi.fn(),
  };
});

// Mock health API
vi.mock("../services/healthApi", async () => {
  const actual = await vi.importActual("../services/healthApi");
  return {
    ...actual,
    checkHealth: vi.fn(),
  };
});

const renderLogin = () => {
  return render(
    <MemoryRouter initialEntries={["/login"]}>
      <I18nProvider i18n={i18n}>
        <AuthProvider>
          <Login />
        </AuthProvider>
      </I18nProvider>
    </MemoryRouter>
  );
};

// Helper to create a healthy response
const createHealthyResponse = (): healthApi.HealthStatus => ({
  status: "ready",
  checks: {
    database: "ok",
    tenant_keys: "ok",
    kek_file: "ok",
  },
  timestamp: "2025-11-29T10:00:00Z",
});

// Helper to create an unhealthy response
const createUnhealthyResponse = (): healthApi.HealthStatus => ({
  status: "not_ready",
  checks: {
    database: "ok",
    tenant_keys: "missing",
    kek_file: "ok",
  },
  timestamp: "2025-11-29T10:00:00Z",
});

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    i18n.load("en", {});
    i18n.activate("en");
    // Default: health check passes
    vi.mocked(healthApi.checkHealth).mockResolvedValue(createHealthyResponse());
  });

  it("renders login form", async () => {
    renderLogin();

    expect(
      screen.getByRole("heading", { name: /secpal/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });
  });

  it("submits login form with email and password", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const mockResponse = {
      token: "test-token",
      user: { id: 1, name: "Test User", email: "test@example.com" },
    };
    mockLogin.mockResolvedValueOnce(mockResponse);

    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
    });
  });

  it("displays error message on login failure", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const testError = new authApi.AuthApiError("Invalid credentials");
    mockLogin.mockRejectedValue(testError); // Use mockRejectedValue instead of mockRejectedValueOnce

    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: "wrong@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpass" } });
    fireEvent.click(submitButton);

    // Wait for the error to appear with explicit screen query
    const errorElement = await screen.findByText(
      /invalid credentials/i,
      {},
      { timeout: 3000 }
    );
    expect(errorElement).toBeInTheDocument();
  });

  it("displays generic error message for non-AuthApiError", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockLogin.mockRejectedValueOnce(new Error("Network error"));

    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password" } });
    fireEvent.click(submitButton);

    const errorElement = await screen.findByText(/network error/i);
    expect(errorElement).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "Login error:",
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it("displays fallback error message for unknown error types", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    mockLogin.mockRejectedValueOnce("string error");

    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password" } });
    fireEvent.click(submitButton);

    const errorElement = await screen.findByText(
      /an unexpected error occurred.*try again.*contact support/i
    );
    expect(errorElement).toBeInTheDocument();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("disables submit button while submitting", async () => {
    const mockLogin = vi.mocked(authApi.login);
    mockLogin.mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 100))
    );

    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password123" } });
    fireEvent.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/logging in/i)).toBeInTheDocument();
  });

  it("clears error message on new submission", async () => {
    const mockLogin = vi.mocked(authApi.login);

    // First call: error
    mockLogin.mockRejectedValueOnce(new authApi.AuthApiError("First error"));

    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });
    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrong" } });
    fireEvent.click(submitButton);

    // Wait for error to appear
    const errorElement = await screen.findByText(
      /first error/i,
      {},
      { timeout: 3000 }
    );
    expect(errorElement).toBeInTheDocument();

    // Second call: success
    mockLogin.mockResolvedValueOnce({
      user: { id: 1, name: "Test", email: "test@example.com" },
    });

    // Second submission should clear error
    fireEvent.change(passwordInput, { target: { value: "correct" } });
    fireEvent.click(submitButton);

    // Wait for error to disappear
    await waitFor(() => {
      expect(screen.queryByText(/first error/i)).not.toBeInTheDocument();
    });
  });

  it("requires email and password fields", async () => {
    renderLogin();

    // Wait for health check to complete
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it("uses email input type for email field", async () => {
    renderLogin();

    // Wait for health check to complete to avoid act() warnings
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute("type", "email");
  });

  it("uses password input type for password field", async () => {
    renderLogin();

    // Wait for health check to complete to avoid act() warnings
    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /log in/i })
      ).toBeInTheDocument();
    });

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute("type", "password");
  });

  describe("Health Check Integration", () => {
    it("enables login when health check passes", async () => {
      vi.mocked(healthApi.checkHealth).mockResolvedValue(
        createHealthyResponse()
      );

      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        const submitButton = screen.getByRole("button", { name: /log in/i });
        expect(submitButton).not.toBeDisabled();
      });

      // No warning should be displayed
      expect(screen.queryByText(/system not ready/i)).not.toBeInTheDocument();
    });

    it("disables login and shows warning when health check returns not_ready", async () => {
      vi.mocked(healthApi.checkHealth).mockResolvedValue(
        createUnhealthyResponse()
      );

      renderLogin();

      // Wait for health check to complete and warning to appear
      await waitFor(() => {
        expect(screen.getByText(/system not ready/i)).toBeInTheDocument();
      });

      // Button should be disabled
      const submitButton = screen.getByRole("button", { name: /log in/i });
      expect(submitButton).toBeDisabled();

      // Input fields should be disabled
      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      expect(emailInput).toBeDisabled();
      expect(passwordInput).toBeDisabled();
    });

    it("disables login and shows warning when health check fails with error", async () => {
      vi.mocked(healthApi.checkHealth).mockRejectedValue(
        new healthApi.HealthCheckError("Network error")
      );

      renderLogin();

      // Wait for health check to complete and warning to appear
      await waitFor(() => {
        expect(screen.getByText(/system not ready/i)).toBeInTheDocument();
      });

      // Button should be disabled
      const submitButton = screen.getByRole("button", { name: /log in/i });
      expect(submitButton).toBeDisabled();
    });

    it("shows 'Checking system...' while health check is in progress", async () => {
      // Create a promise that we can control
      let resolveHealthCheck: (value: healthApi.HealthStatus) => void;
      const healthCheckPromise = new Promise<healthApi.HealthStatus>(
        (resolve) => {
          resolveHealthCheck = resolve;
        }
      );
      vi.mocked(healthApi.checkHealth).mockReturnValue(healthCheckPromise);

      renderLogin();

      // Should show "Checking system..." while loading
      expect(screen.getByText(/checking system/i)).toBeInTheDocument();

      // Resolve the health check
      resolveHealthCheck!(createHealthyResponse());

      // Wait for the button text to change
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });
    });

    it("displays administrator contact message when system not ready", async () => {
      vi.mocked(healthApi.checkHealth).mockResolvedValue(
        createUnhealthyResponse()
      );

      renderLogin();

      await waitFor(() => {
        expect(
          screen.getByText(/contact your administrator/i)
        ).toBeInTheDocument();
      });
    });

    it("has accessible warning with proper ARIA attributes", async () => {
      vi.mocked(healthApi.checkHealth).mockResolvedValue(
        createUnhealthyResponse()
      );

      renderLogin();

      await waitFor(() => {
        const warning = screen.getByRole("alert");
        expect(warning).toHaveAttribute("aria-live", "polite");
      });
    });
  });

  describe("login rate limiting", () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it("records failed login attempts", async () => {
      const mockLogin = vi.mocked(authApi.login);
      mockLogin.mockRejectedValue(
        new authApi.AuthApiError("Invalid credentials")
      );

      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /log in/i });

      // First failed attempt
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "wrong" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
      });

      // Check localStorage has recorded the attempt
      const stored = localStorage.getItem("login_rate_limit");
      expect(stored).not.toBeNull();
      const parsed = JSON.parse(stored!);
      expect(parsed.attempts).toBe(1);
    });

    it("shows remaining attempts warning after 3 failed attempts", async () => {
      // Pre-set 2 failed attempts in localStorage
      const initialState = {
        attempts: 2,
        lockoutEndTime: null,
        lastAttemptTime: Date.now(),
      };
      localStorage.setItem("login_rate_limit", JSON.stringify(initialState));

      const mockLogin = vi.mocked(authApi.login);
      mockLogin.mockRejectedValue(
        new authApi.AuthApiError("Invalid credentials")
      );

      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /log in/i });

      // Third failed attempt - should show warning
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "wrong" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/attempt\(s\) remaining/i)).toBeInTheDocument();
      });
    });

    it("locks user out after 5 failed attempts", async () => {
      // Pre-set 4 failed attempts in localStorage
      const initialState = {
        attempts: 4,
        lockoutEndTime: null,
        lastAttemptTime: Date.now(),
      };
      localStorage.setItem("login_rate_limit", JSON.stringify(initialState));

      const mockLogin = vi.mocked(authApi.login);
      mockLogin.mockRejectedValue(
        new authApi.AuthApiError("Invalid credentials")
      );

      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /log in/i });

      // Fifth failed attempt - should trigger lockout
      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "wrong" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(
          screen.getByText(/too many failed attempts/i)
        ).toBeInTheDocument();
      });
    });

    it("disables form inputs and button during lockout", async () => {
      // Pre-set lockout state in localStorage
      const futureTime = Date.now() + 30000; // 30 seconds in future
      const lockedState = {
        attempts: 5,
        lockoutEndTime: futureTime,
        lastAttemptTime: Date.now(),
      };
      localStorage.setItem("login_rate_limit", JSON.stringify(lockedState));

      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        expect(screen.getByLabelText(/email/i)).toBeDisabled();
      });

      expect(screen.getByLabelText(/password/i)).toBeDisabled();
      expect(screen.getByRole("button", { name: /locked/i })).toBeDisabled();
    });

    it("shows countdown timer during lockout", async () => {
      // Pre-set lockout state in localStorage
      const futureTime = Date.now() + 30000; // 30 seconds in future
      const lockedState = {
        attempts: 5,
        lockoutEndTime: futureTime,
        lastAttemptTime: Date.now(),
      };
      localStorage.setItem("login_rate_limit", JSON.stringify(lockedState));

      renderLogin();

      await waitFor(() => {
        // Button should show remaining seconds
        expect(
          screen.getByRole("button", { name: /locked/i })
        ).toBeInTheDocument();
      });
    });

    it("resets rate limit state on successful login", async () => {
      // Pre-set some failed attempts
      const initialState = {
        attempts: 2,
        lockoutEndTime: null,
        lastAttemptTime: Date.now(),
      };
      localStorage.setItem("login_rate_limit", JSON.stringify(initialState));

      const mockLogin = vi.mocked(authApi.login);
      mockLogin.mockResolvedValueOnce({
        user: { id: 1, name: "Test", email: "test@example.com" },
      });

      renderLogin();

      // Wait for health check to complete
      await waitFor(() => {
        expect(
          screen.getByRole("button", { name: /log in/i })
        ).toBeInTheDocument();
      });

      const emailInput = screen.getByLabelText(/email/i);
      const passwordInput = screen.getByLabelText(/password/i);
      const submitButton = screen.getByRole("button", { name: /log in/i });

      fireEvent.change(emailInput, { target: { value: "test@example.com" } });
      fireEvent.change(passwordInput, { target: { value: "correct" } });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // After successful login, localStorage should be cleared
        expect(localStorage.getItem("login_rate_limit")).toBeNull();
      });
    });
  });
});
