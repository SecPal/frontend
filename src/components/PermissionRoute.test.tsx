// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { PermissionRoute } from "./PermissionRoute";
import * as authHook from "../hooks/useAuth";

// Mock useAuth hook
vi.mock("../hooks/useAuth");

describe("PermissionRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("should render children when user has required permission", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn((perm) => perm === "test.read"),
      isLoading: false,
      isAuthenticated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/test"]}>
          <Routes>
            <Route
              path="/test"
              element={
                <PermissionRoute permission="test.read">
                  <div>Protected Content</div>
                </PermissionRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("should show access denied when user lacks required permission", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(() => false),
      isLoading: false,
      isAuthenticated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/test"]}>
          <Routes>
            <Route
              path="/test"
              element={
                <PermissionRoute permission="test.read">
                  <div>Protected Content</div>
                </PermissionRoute>
              }
            />
            <Route path="/" element={<div>Home Page</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.getByText("Access Denied")).toBeInTheDocument();
    expect(screen.queryByText("Home Page")).not.toBeInTheDocument();
  });

  it("should redirect to custom fallback path when specified", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(() => false),
      isLoading: false,
      isAuthenticated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/test"]}>
          <Routes>
            <Route
              path="/test"
              element={
                <PermissionRoute permission="test.read" fallbackPath="/denied">
                  <div>Protected Content</div>
                </PermissionRoute>
              }
            />
            <Route path="/denied" element={<div>Access Denied Page</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.getByText("Access Denied Page")).toBeInTheDocument();
  });

  it("should show loading state while checking permissions", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(() => true),
      isLoading: true,
      isAuthenticated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/test"]}>
          <Routes>
            <Route
              path="/test"
              element={
                <PermissionRoute permission="test.read">
                  <div>Protected Content</div>
                </PermissionRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
  });

  it("should support wildcard permissions", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn((perm) => perm === "activity_log.read"),
      isLoading: false,
      isAuthenticated: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/test"]}>
          <Routes>
            <Route
              path="/test"
              element={
                <PermissionRoute permission="activity_log.read">
                  <div>Activity Logs</div>
                </PermissionRoute>
              }
            />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByText("Activity Logs")).toBeInTheDocument();
  });

  it("should redirect unauthenticated users to login", () => {
    vi.mocked(authHook.useAuth).mockReturnValue({
      hasPermission: vi.fn(() => false),
      isLoading: false,
      isAuthenticated: false,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      hasRole: vi.fn(),
      hasOrganizationalAccess: vi.fn(),
    });

    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/test"]}>
          <Routes>
            <Route
              path="/test"
              element={
                <PermissionRoute permission="test.read">
                  <div>Protected Content</div>
                </PermissionRoute>
              }
            />
            <Route path="/login" element={<div>Login Page</div>} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    expect(screen.getByText("Login Page")).toBeInTheDocument();
    expect(screen.queryByText("Access Denied")).not.toBeInTheDocument();
  });
});
