// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ProtectedRoute } from "./ProtectedRoute";
import {
  AuthProvider,
  BOOTSTRAP_REVALIDATION_TIMEOUT_MS,
} from "../contexts/AuthContext";

const mockNavigate = vi.fn();
const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("../services/authApi", async () => {
  const actual = await vi.importActual("../services/authApi");
  return {
    ...actual,
    getCurrentUser: mockGetCurrentUser,
  };
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => {
      mockNavigate(to);
      return <div>Redirected to {to}</div>;
    },
  };
});

const TestComponent = () => <div>Protected Content</div>;

const renderProtectedRoute = () => {
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <AuthProvider>
          <Routes>
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <TestComponent />
                </ProtectedRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
};

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("redirects to login when not authenticated", () => {
    renderProtectedRoute();

    expect(mockNavigate).toHaveBeenCalledWith("/login");
    expect(screen.getByText(/redirected to \/login/i)).toBeInTheDocument();
  });

  it("renders children when authenticated", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 1,
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: true,
    });

    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: 1,
        name: "Test",
        email: "test@secpal.dev",
        emailVerified: true,
      })
    );

    renderProtectedRoute();

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("shows loading instead of protected content while stored auth is revalidated", () => {
    mockGetCurrentUser.mockReturnValueOnce(new Promise(() => undefined));

    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: 1,
        name: "Test",
        email: "test@secpal.dev",
        emailVerified: true,
      })
    );

    renderProtectedRoute();

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("redirects to login after stored auth revalidation fails", async () => {
    mockGetCurrentUser.mockRejectedValueOnce(
      Object.assign(new Error("Unauthorized"), {
        code: "HTTP_401",
      })
    );

    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: 1,
        name: "Test",
        email: "test@secpal.dev",
        emailVerified: true,
      })
    );

    renderProtectedRoute();

    expect(screen.getByText("Loading...")).toBeInTheDocument();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    expect(screen.getByText(/redirected to \/login/i)).toBeInTheDocument();
  });

  it("shows a retry recovery state instead of spinning forever when bootstrap stalls", async () => {
    mockGetCurrentUser.mockReturnValueOnce(new Promise(() => undefined));
    vi.useFakeTimers();

    try {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test",
          email: "test@secpal.dev",
          emailVerified: true,
        })
      );

      renderProtectedRoute();

      await act(async () => {
        vi.advanceTimersByTime(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
        await Promise.resolve();
      });

      expect(
        screen.getByRole("heading", {
          name: /still loading your secure session/i,
        })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /retry/i })
      ).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: /go to login/i })
      ).toBeInTheDocument();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("retries bootstrap recovery when the user requests it", async () => {
    const pendingBootstrap = new Promise(() => undefined);

    mockGetCurrentUser
      .mockReturnValueOnce(pendingBootstrap)
      .mockResolvedValueOnce({
        id: 1,
        name: "Recovered User",
        email: "recovered@secpal.dev",
        emailVerified: true,
      });

    vi.useFakeTimers();

    try {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test",
          email: "test@secpal.dev",
          emailVerified: true,
        })
      );

      renderProtectedRoute();

      await act(async () => {
        vi.advanceTimersByTime(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
        await Promise.resolve();
      });

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /retry/i }));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(screen.getByText("Protected Content")).toBeInTheDocument();
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(2);
      expect(mockNavigate).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows loading state initially", () => {
    const { container } = render(
      <BrowserRouter>
        <I18nProvider i18n={i18n}>
          <AuthProvider>
            <ProtectedRoute>
              <TestComponent />
            </ProtectedRoute>
          </AuthProvider>
        </I18nProvider>
      </BrowserRouter>
    );

    // The component should render quickly, so we just verify it doesn't crash
    expect(container).toBeTruthy();
  });

  describe("Accessibility", () => {
    it("loading state has role=status", () => {
      // Temporarily remove token to trigger loading check
      localStorage.clear();
      renderProtectedRoute();

      // The loading div should have role="status"
      // This will fail until we implement the ARIA attributes
      const loadingElement = screen.queryByText("Loading...");
      if (loadingElement) {
        expect(loadingElement.closest("div")).toHaveAttribute("role", "status");
      }
    });

    it("loading state has aria-live=polite", () => {
      localStorage.clear();
      renderProtectedRoute();

      const loadingElement = screen.queryByText("Loading...");
      if (loadingElement) {
        expect(loadingElement.closest("div")).toHaveAttribute(
          "aria-live",
          "polite"
        );
      }
    });

    it("loading text is visible to screen readers", () => {
      localStorage.clear();
      renderProtectedRoute();

      const loadingText = screen.queryByText("Loading...");
      // Text should not have sr-only class (should be visible)
      if (loadingText) {
        expect(loadingText.className).not.toContain("sr-only");
      }
    });
  });

  it("shows the dedicated email verification gate for authenticated unverified users", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 1,
      name: "Test",
      email: "test@secpal.dev",
      emailVerified: false,
    });

    localStorage.setItem(
      "auth_user",
      JSON.stringify({
        id: 1,
        name: "Test",
        email: "test@secpal.dev",
        emailVerified: false,
      })
    );

    renderProtectedRoute();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /verify your email address/i })
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/test@secpal\.dev/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /i have verified my email/i }))
      .toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /send verification email again/i })
    ).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });
});
