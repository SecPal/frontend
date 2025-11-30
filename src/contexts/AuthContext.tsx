// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { AuthContext, type User } from "./auth-context";
import { authStorage } from "../services/storage";
import { sessionEvents } from "../services/sessionEvents";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    return authStorage.getUser();
  });

  const [isLoading] = useState(false);

  const login = useCallback((newUser: User) => {
    authStorage.setUser(newUser);
    setUser(newUser);
  }, []);

  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
  }, []);

  /**
   * Check if user has a specific role
   */
  const hasRole = useCallback(
    (role: string): boolean => {
      return user?.roles?.includes(role) ?? false;
    },
    [user]
  );

  /**
   * Check if user has a specific permission.
   * Supports wildcard matching (e.g., "employees.*" matches "employees.read").
   */
  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user?.permissions) return false;

      // Direct match
      if (user.permissions.includes(permission)) return true;

      // Wildcard match: check if user has resource.* for resource.action
      if (permission.includes(".")) {
        const [resource] = permission.split(".");
        if (user.permissions.includes(`${resource}.*`)) return true;
      }

      return false;
    },
    [user]
  );

  /**
   * Check if user has any organizational scopes
   * (required for Organization and Customer management)
   */
  const hasOrganizationalAccess = useCallback((): boolean => {
    return user?.hasOrganizationalScopes ?? false;
  }, [user]);

  // Subscribe to session:expired events
  // This handles 401 responses from API calls (when online)
  useEffect(() => {
    const unsubscribe = sessionEvents.on("session:expired", () => {
      // Check authStorage instead of user state to avoid adding user as dependency.
      // Adding user would cause re-subscription on every user change, which is unnecessary.
      // authStorage and user state are always in sync via login/logout functions.
      if (authStorage.getUser()) {
        logout();
      }
    });

    return unsubscribe;
  }, [logout]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      logout,
      hasRole,
      hasPermission,
      hasOrganizationalAccess,
    }),
    [
      user,
      isLoading,
      login,
      logout,
      hasRole,
      hasPermission,
      hasOrganizationalAccess,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
