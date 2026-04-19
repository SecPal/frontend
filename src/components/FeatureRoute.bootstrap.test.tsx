// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { FeatureRoute } from "./FeatureRoute";
import { AuthProvider } from "../contexts/AuthContext";

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

function setCsrfTokenCookie(value: string): void {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(value)};path=/`;
}

function renderEmployeesFeatureRoute() {
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <AuthProvider>
          <Routes>
            <Route
              path="/employees"
              element={
                <FeatureRoute feature="employees">
                  <div>Employees Content</div>
                </FeatureRoute>
              }
            />
          </Routes>
        </AuthProvider>
      </I18nProvider>
    </BrowserRouter>
  );
}

describe("FeatureRoute browser-session bootstrap", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
    window.history.replaceState({}, "", "/employees");
    setCsrfTokenCookie("test-csrf-token");
    i18n.load("en", {});
    i18n.activate("en");
    mockGetCurrentUser.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), {
        code: "HTTP_401",
      })
    );
  });

  it("rehydrates a valid browser session on a deep-linked feature route without local auth storage", async () => {
    mockGetCurrentUser.mockResolvedValueOnce({
      id: "1",
      name: "Employee Manager",
      email: "manager@secpal.dev",
      emailVerified: true,
      hasOrganizationalScopes: true,
      permissions: ["employees.read"],
      roles: [],
    });

    renderEmployeesFeatureRoute();

    expect(await screen.findByText("Employees Content")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("redirects to login on a deep-linked feature route when browser-session bootstrap confirms the session is unauthenticated", async () => {
    renderEmployeesFeatureRoute();

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    expect(screen.getByText(/redirected to \/login/i)).toBeInTheDocument();
  });
});
