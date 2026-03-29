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
import { hasUserPermission, hasUserRole } from "../lib/capabilities";
import { syncOfflineSessionAccess } from "../lib/serviceWorkerSession";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(() => {
    return authStorage.getUser();
  });

  const [isLoading, setIsLoading] = useState(() => {
    return authStorage.getUser() !== null && isOnline();
  });
  const isClearingSessionRef = useRef(false);
  const bootstrapRequestVersionRef = useRef(0);

  const invalidateBootstrapRevalidation = useCallback(() => {
    bootstrapRequestVersionRef.current += 1;
  }, []);

  const syncOfflineAuthState = useCallback((isAuthenticated: boolean) => {
    void syncOfflineSessionAccess(isAuthenticated).catch((error: unknown) => {
      console.warn("Failed to synchronize offline auth state:", error);
    });
  }, []);

  const clearAuthenticatedState = useCallback(
    (clearSensitiveState: boolean) => {
      if (isClearingSessionRef.current) {
        return;
      }

      invalidateBootstrapRevalidation();
      isClearingSessionRef.current = true;
      authStorage.clear();
      setUser(null);
      setIsLoading(false);
      syncOfflineAuthState(false);

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
    [invalidateBootstrapRevalidation, syncOfflineAuthState]
  );

  const login = useCallback(
    (newUser: User) => {
      invalidateBootstrapRevalidation();
      authStorage.setUser(newUser);
      setUser(newUser);
      setIsLoading(false);
      syncOfflineAuthState(true);
    },
    [invalidateBootstrapRevalidation, syncOfflineAuthState]
  );

  const logout = useCallback(() => {
    clearAuthenticatedState(true);
  }, [clearAuthenticatedState]);

  /**
   * Check if user has a specific role
   */
  const hasRole = useCallback(
    (role: string): boolean => {
      return hasUserRole(user, role);
    },
    [user]
  );

  /**
   * Check if user has a specific permission.
   * Supports wildcard matching (e.g., "employees.*" matches "employees.read").
   */
  const hasPermission = useCallback(
    (permission: string): boolean => {
      return hasUserPermission(user, permission);
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

  // Bootstrap: revalidate any stored session on app load/refresh when online.
  // Uses getCurrentUser() to confirm the session and clear it if invalid.
  useEffect(() => {
    syncOfflineAuthState(authStorage.getUser() !== null);
  }, [syncOfflineAuthState]);

  useEffect(() => {
    const storedUser = authStorage.getUser();

    if (!storedUser || !isOnline()) {
      return;
    }

    let isActive = true;
    const requestVersion = bootstrapRequestVersionRef.current + 1;
    bootstrapRequestVersionRef.current = requestVersion;

    void getCurrentUser()
      .then((currentUser) => {
        if (
          !isActive ||
          bootstrapRequestVersionRef.current !== requestVersion
        ) {
          return;
        }

        authStorage.setUser(currentUser);
        setUser(currentUser);
        setIsLoading(false);
        syncOfflineAuthState(true);
      })
      .catch(() => {
        if (
          !isActive ||
          bootstrapRequestVersionRef.current !== requestVersion
        ) {
          return;
        }

        clearAuthenticatedState(true);
      });

    return () => {
      isActive = false;
    };
  }, [clearAuthenticatedState, syncOfflineAuthState]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage || event.key !== "auth_user") {
        return;
      }

      if (event.newValue === null) {
        clearAuthenticatedState(true);
        return;
      }

      try {
        const nextUser = JSON.parse(event.newValue) as User;

        invalidateBootstrapRevalidation();
        setUser(nextUser);
        setIsLoading(false);
        syncOfflineAuthState(true);
      } catch (error) {
        console.error("Failed to parse cross-tab auth state:", error);
        clearAuthenticatedState(true);
      }
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [
    clearAuthenticatedState,
    invalidateBootstrapRevalidation,
    syncOfflineAuthState,
  ]);

  useEffect(() => {
    const reconcileRestoredPageState = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        return;
      }

      const storedUser = authStorage.getUser();

      if (!storedUser) {
        if (user) {
          clearAuthenticatedState(false);
        }

        return;
      }

      invalidateBootstrapRevalidation();
      setUser(storedUser);
      setIsLoading(false);
      syncOfflineAuthState(true);
    };

    window.addEventListener("pageshow", reconcileRestoredPageState);

    return () => {
      window.removeEventListener("pageshow", reconcileRestoredPageState);
    };
  }, [
    clearAuthenticatedState,
    invalidateBootstrapRevalidation,
    syncOfflineAuthState,
    user,
  ]);

  // Subscribe to session:expired events.
  // This handles 401 responses from API calls when online.
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
