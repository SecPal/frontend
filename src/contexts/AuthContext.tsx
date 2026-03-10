// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { AuthContext, type User } from "./auth-context";
import { authStorage } from "../services/storage";
import { getCurrentUser } from "../services/authApi";
import { sessionEvents, isOnline } from "../services/sessionEvents";
import { clearSensitiveClientState } from "../lib/clientStateCleanup";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    return authStorage.getUser();
  });

  const [isLoading, setIsLoading] = useState(() => {
    return authStorage.getUser() !== null && isOnline();
  });
  const isClearingSessionRef = useRef(false);

  const clearAuthenticatedState = useCallback(
    (clearSensitiveState: boolean) => {
      if (isClearingSessionRef.current) {
        return;
      }

      isClearingSessionRef.current = true;
      authStorage.clear();
      setUser(null);
      setIsLoading(false);

      if (!clearSensitiveState) {
        isClearingSessionRef.current = false;
        return;
      }

      void clearSensitiveClientState()
        .catch((error: unknown) => {
          console.error(
            "Failed to clear sensitive client state during logout:",
            error
          );
        })
        .finally(() => {
          isClearingSessionRef.current = false;
        });
    },
    []
  );

  const login = useCallback((newUser: User) => {
    authStorage.setUser(newUser);
    setUser(newUser);
    setIsLoading(false);
  }, []);

  const logout = useCallback(() => {
    clearAuthenticatedState(true);
  }, [clearAuthenticatedState]);

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
    const storedUser = authStorage.getUser();

    if (!storedUser || !isOnline()) {
      return;
    }

    let isActive = true;

    void getCurrentUser()
      .then((currentUser) => {
        if (!isActive) {
          return;
        }

        authStorage.setUser(currentUser);
        setUser(currentUser);
        setIsLoading(false);
      })
      .catch(() => {
        if (!isActive) {
          return;
        }

        clearAuthenticatedState(true);
      });

    return () => {
      isActive = false;
    };
  }, [clearAuthenticatedState]);

  useEffect(() => {
    const unsubscribe = sessionEvents.on("session:expired", () => {
      // Check authStorage instead of user state to avoid adding user as dependency.
      // Adding user would cause re-subscription on every user change, which is unnecessary.
      // authStorage and user state are always in sync via login/logout functions.
      if (authStorage.getUser()) {
        clearAuthenticatedState(true);
      }
    });

    return unsubscribe;
  }, [clearAuthenticatedState]);

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
