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

describe("Login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders login form", () => {
    renderLogin();

    expect(
      screen.getByRole("heading", { name: /secpal/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("submits login form with email and password", async () => {
    const mockLogin = vi.mocked(authApi.login);
    const mockResponse = {
      token: "test-token",
      user: { id: 1, name: "Test User", email: "test@example.com" },
    };
    mockLogin.mockResolvedValueOnce(mockResponse);

    renderLogin();

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

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submitButton = screen.getByRole("button", { name: /log in/i });

    fireEvent.change(emailInput, { target: { value: "test@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "password" } });
    fireEvent.click(submitButton);

    const errorElement = await screen.findByText(
      /an unexpected error occurred.*check console/i
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

  it("requires email and password fields", () => {
    renderLogin();

    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/password/i);

    expect(emailInput).toBeRequired();
    expect(passwordInput).toBeRequired();
  });

  it("uses email input type for email field", () => {
    renderLogin();

    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toHaveAttribute("type", "email");
  });

  it("uses password input type for password field", () => {
    renderLogin();

    const passwordInput = screen.getByLabelText(/password/i);
    expect(passwordInput).toHaveAttribute("type", "password");
  });
});
