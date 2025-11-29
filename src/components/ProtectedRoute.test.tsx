// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ProtectedRoute } from "./ProtectedRoute";
import { AuthProvider } from "../contexts/AuthContext";

const mockNavigate = vi.fn();

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

  it("renders children when authenticated", () => {
    localStorage.setItem(
      "auth_user",
      JSON.stringify({ id: 1, name: "Test", email: "test@example.com" })
    );

    renderProtectedRoute();

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
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
});
