// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { OrganizationalRoute } from "./OrganizationalRoute";
import * as authHook from "../hooks/useAuth";

vi.mock("../hooks/useAuth");

describe("OrganizationalRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("renders children when the user has organizational access", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(),
      isLoading: false,
      isAuthenticated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn(),
      hasOrganizationalAccess: vi.fn(() => true),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/organization"]}>
          <Routes>
            <Route
              path="/organization"
              element={
                <OrganizationalRoute>
                  <div>Organization Content</div>
                </OrganizationalRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByText("Organization Content")).toBeInTheDocument();
  });

  it("shows access denied when the user lacks organizational access", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(),
      isLoading: false,
      isAuthenticated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn(),
      hasOrganizationalAccess: vi.fn(() => false),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/organization"]}>
          <Routes>
            <Route
              path="/organization"
              element={
                <OrganizationalRoute>
                  <div>Organization Content</div>
                </OrganizationalRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(
      screen.getByText(/You do not have permission to access this feature/i)
    ).toBeInTheDocument();
    expect(screen.queryByText("Organization Content")).not.toBeInTheDocument();
  });

  it("redirects unauthenticated users to login", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(),
      isLoading: false,
      isAuthenticated: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn(),
      hasOrganizationalAccess: vi.fn(() => false),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/organization"]}>
          <Routes>
            <Route
              path="/organization"
              element={
                <OrganizationalRoute>
                  <div>Organization Content</div>
                </OrganizationalRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
  });
});
