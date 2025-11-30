// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { AuthProvider } from "./AuthContext";
import { useAuth } from "../hooks/useAuth";

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

describe("AuthContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe("hasRole", () => {
    it("returns true when user has the specified role", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@example.com",
          roles: ["Admin", "Manager"],
        })
      );

      render(
        <AuthProvider>
          <PermissionTestComponent role="Admin" />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasRole")).toHaveTextContent("true");
    });

    it("returns false when user does not have the specified role", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@example.com",
          roles: ["Guard"],
        })
      );

      render(
        <AuthProvider>
          <PermissionTestComponent role="Admin" />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasRole")).toHaveTextContent("false");
    });

    it("returns false when user has no roles", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@example.com",
        })
      );

      render(
        <AuthProvider>
          <PermissionTestComponent role="Admin" />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasRole")).toHaveTextContent("false");
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
    it("returns true for direct permission match", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@example.com",
          permissions: ["employees.read", "employees.create"],
        })
      );

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasPermission")).toHaveTextContent("true");
    });

    it("returns false when permission is not present", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@example.com",
          permissions: ["employees.read"],
        })
      );

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.delete" />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
    });

    it("returns true for wildcard permission match", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@example.com",
          permissions: ["employees.*"],
        })
      );

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.delete" />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasPermission")).toHaveTextContent("true");
    });

    it("does not match wildcard across different resources", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@example.com",
          permissions: ["employees.*"],
        })
      );

      render(
        <AuthProvider>
          <PermissionTestComponent permission="shifts.read" />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
    });

    it("returns false when user has no permissions", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@example.com",
        })
      );

      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
    });

    it("returns false when user is null", () => {
      render(
        <AuthProvider>
          <PermissionTestComponent permission="employees.read" />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasPermission")).toHaveTextContent("false");
    });

    it("handles permission without dot separator", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@example.com",
          permissions: ["admin"],
        })
      );

      render(
        <AuthProvider>
          <PermissionTestComponent permission="admin" />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasPermission")).toHaveTextContent("true");
    });
  });

  describe("hasOrganizationalAccess", () => {
    it("returns true when hasOrganizationalScopes is true", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@example.com",
          hasOrganizationalScopes: true,
        })
      );

      render(
        <AuthProvider>
          <PermissionTestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("true");
    });

    it("returns false when hasOrganizationalScopes is false", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@example.com",
          hasOrganizationalScopes: false,
        })
      );

      render(
        <AuthProvider>
          <PermissionTestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("false");
    });

    it("returns false when hasOrganizationalScopes is undefined", () => {
      localStorage.setItem(
        "auth_user",
        JSON.stringify({
          id: 1,
          name: "Test User",
          email: "test@example.com",
        })
      );

      render(
        <AuthProvider>
          <PermissionTestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("false");
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
    it("updates hasOrganizationalAccess after login", () => {
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
                  id: 1,
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

      expect(screen.getByTestId("hasOrgAccess")).toHaveTextContent("true");
    });
  });
});
