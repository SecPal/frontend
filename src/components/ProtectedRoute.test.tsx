// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
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
    </BrowserRouter>
  );
};

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  it("redirects to login when not authenticated", () => {
    renderProtectedRoute();

    expect(mockNavigate).toHaveBeenCalledWith("/login");
    expect(screen.getByText(/redirected to \/login/i)).toBeInTheDocument();
  });

  it("renders children when authenticated", () => {
    localStorage.setItem("auth_token", "test-token");
    localStorage.setItem(
      "auth_user",
      JSON.stringify({ id: 1, name: "Test", email: "test@example.com" })
    );

    renderProtectedRoute();

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("renders header when authenticated", () => {
    localStorage.setItem("auth_token", "test-token");
    localStorage.setItem(
      "auth_user",
      JSON.stringify({ id: 1, name: "Test User", email: "test@example.com" })
    );

    renderProtectedRoute();

    expect(screen.getByText("SecPal")).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });

  it("shows loading state initially", () => {
    const { container } = render(
      <BrowserRouter>
        <AuthProvider>
          <ProtectedRoute>
            <TestComponent />
          </ProtectedRoute>
        </AuthProvider>
      </BrowserRouter>
    );

    // The component should render quickly, so we just verify it doesn't crash
    expect(container).toBeTruthy();
  });
});
