// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "../hooks/useAuth";
import { sanitizePersistedAuthUser } from "../services/authState";
import { authStorage } from "../services/storage";

vi.mock("../services/authApi", () => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("../services/sessionEvents", () => ({
  isOnline: vi.fn(() => false),
  sessionEvents: {
    on: vi.fn(() => () => undefined),
  },
}));

// Test component for permission checks
function PermissionTestComponent({
  role,
  permission,
}: {
  role?: string;
  permission?: string;
}) {
  const auth = useAuth();
  return (
    <div>
      {role && (
        <span data-testid="hasRole">
          {auth.hasRole(role) ? "true" : "false"}
        </span>
      )}
      {permission && (
        <span data-testid="hasPermission">
          {auth.hasPermission(permission) ? "true" : "false"}
        </span>
      )}
      <span data-testid="hasOrgAccess">
        {auth.hasOrganizationalAccess() ? "true" : "false"}
      </span>
    </div>
  );
}

async function seedStoredUser(user: Record<string, unknown>) {
  const persistedUser = sanitizePersistedAuthUser({
    emailVerified: false,
    ...user,
  });

  if (!persistedUser) {
    throw new Error("Failed to seed persisted auth user for test");
  }

  await authStorage.setUser(persistedUser);
}

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
    document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
    document.cookie = "XSRF-TOKEN=test-csrf-token;path=/";
  });

  describe("hasRole", () => {
    it("returns true when user has the specified role", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        roles: ["Admin", "Manager"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent role="Admin" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasRole")).toHaveTextContent("true");
      });
    });

    it("returns false when user does not have the specified role", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        roles: ["Guard"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent role="Admin" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasRole")).toHaveTextContent("false");
      });
    });

    it("returns false when user has no roles", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
      });

      render(
        <AuthProvider>
          <PermissionTestComponent role="Admin" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasRole")).toHaveTextContent("false");
      });
    });

    it("returns false when user is null", () => {
      render(
        <AuthProvider>
          <PermissionTestComponent role="Admin" />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasRole")).toHaveTextContent("false");
    });
  });

  describe("hasPermission", () => {
    it("returns true for direct permission match", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["employees.read", "employees.create"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("true");
      });
    });

    it("returns false when permission is not present", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["employees.read"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.delete" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
      });
    });

    it("returns true for wildcard permission match", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["employees.*"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.delete" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("true");
      });
    });

    it("does not match wildcard across different resources", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["employees.*"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="shifts.read" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
      });
    });

    it("returns false when user has no permissions", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
      });
    });

    it("returns false when user is null", () => {
      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
    });

    it("handles permission without dot separator", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        permissions: ["admin"],
      });

      render(
        <AuthProvider>
          <PermissionTestComponent permission="admin" />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasPermission")).toHaveTextContent("true");
      });
    });
  });

  describe("hasOrganizationalAccess", () => {
    it("returns true when hasOrganizationalScopes is true", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        hasOrganizationalScopes: true,
      });

      render(
        <AuthProvider>
          <PermissionTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("true");
      });
    });

    it("returns false when hasOrganizationalScopes is false", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        hasOrganizationalScopes: false,
      });

      render(
        <AuthProvider>
          <PermissionTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("false");
      });
    });

    it("returns false when hasOrganizationalScopes is undefined", async () => {
      await seedStoredUser({
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
      });

      render(
        <AuthProvider>
          <PermissionTestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("false");
      });
    });

    it("returns false when user is null", () => {
      render(
        <AuthProvider>
          <PermissionTestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("false");
    });
  });

  describe("login updates permission state", () => {
    it("updates hasOrganizationalAccess after login", async () => {
      const LoginComponent = () => {
        const auth = useAuth();
        return (
          <div>
            <span data-testid="hasOrgAccess">
              {auth.hasOrganizationalAccess() ? "true" : "false"}
            </span>
            <button
              onClick={() =>
                auth.login({
                  id: "1",
                  name: "Test",
                  email: "test@test.com",
                  hasOrganizationalScopes: true,
                })
              }
            >
              Login
            </button>
          </div>
        );
      };

      render(
        <AuthProvider>
          <LoginComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("false");

      act(() => {
        screen.getByText("Login").click();
      });

      await waitFor(() => {
        expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("true");
      });
    });
  });
});
