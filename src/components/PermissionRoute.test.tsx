// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { PermissionRoute } from "./PermissionRoute";
import * as authHook from "../hooks/useAuth";

// Mock useAuth hook
vi.mock("../hooks/useAuth");

describe("PermissionRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    );

    expect(screen.getByText("Protected Content")).toBeInTheDocument();
  });

  it("should redirect when user lacks required permission", () => {
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
    );

    expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    expect(screen.getByText("Home Page")).toBeInTheDocument();
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
    );

    expect(screen.getByText("Activity Logs")).toBeInTheDocument();
  });
});
