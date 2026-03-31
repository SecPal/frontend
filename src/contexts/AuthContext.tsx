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
import { getAuthTransport } from "../services/authTransport";
import { sanitizeAuthUser } from "../services/authState";
import { authStorage } from "../services/storage";
import { sessionEvents, isOnline } from "../services/sessionEvents";
import { clearSensitiveClientState } from "../lib/clientStateCleanup";
import { hasUserPermission, hasUserRole } from "../lib/capabilities";
import { syncOfflineSessionAccess } from "../lib/serviceWorkerSession";
import { analytics } from "../lib/analytics";

const BOOTSTRAP_REVALIDATION_TIMEOUT_MS = 3500;

function getBootstrapErrorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }

  const code = (error as { code?: unknown }).code;

  return typeof code === "string" && code.trim().length > 0 ? code : null;
}

function getBootstrapErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  return "";
}

function isInvalidBootstrapSessionError(error: unknown): boolean {
  const code = getBootstrapErrorCode(error)?.toUpperCase();

  if (code === "HTTP_401" || code === "NO_STORED_TOKEN") {
    return true;
  }

  const message = getBootstrapErrorMessage(error).toLowerCase();

  return (
    message.includes("401") ||
    message.includes("unauthorized") ||
    message.includes("unauthenticated") ||
    message.includes("no stored token") ||
    message.includes("android auth token is not available")
  );
}

function isOfflineBootstrapError(error: unknown): boolean {
  const code = getBootstrapErrorCode(error)?.toUpperCase();

  if (code === "NETWORK_OFFLINE") {
    return true;
  }

  const message = getBootstrapErrorMessage(error).toLowerCase();

  return (
    message.includes("active internet connection") ||
    message.includes("network offline")
  );
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const authTransport = useMemo(() => getAuthTransport(), []);
  const [user, setUser] = useState<User | null>(() => {
    return authStorage.getUser();
  });

  const [isLoading, setIsLoading] = useState(() => {
    return authStorage.getUser() !== null && isOnline();
  });
  const [bootstrapRecoveryReason, setBootstrapRecoveryReason] = useState<
    "timeout" | "network" | null
  >(null);
  const [bootstrapRetryKey, setBootstrapRetryKey] = useState(0);
  const isClearingSessionRef = useRef(false);
  const bootstrapRequestVersionRef = useRef(0);
  const hasLogoutBarrierRef = useRef(authStorage.hasLogoutBarrier());

  const invalidateBootstrapRevalidation = useCallback(() => {
    bootstrapRequestVersionRef.current += 1;
  }, []);

  const syncOfflineAuthState = useCallback((isAuthenticated: boolean) => {
    void syncOfflineSessionAccess(isAuthenticated).catch((error: unknown) => {
      console.warn("Failed to synchronize offline auth state:", error);
    });
  }, []);

  const resetAnalyticsState = useCallback(() => {
    if (!analytics) {
      return;
    }

    void analytics.resetForLogout().catch((error: unknown) => {
      console.warn("Failed to reset analytics state during logout:", error);
    });
  }, []);

  const clearAuthenticatedState = useCallback(
    (clearSensitiveState: boolean) => {
      if (isClearingSessionRef.current) {
        return;
      }

      invalidateBootstrapRevalidation();
      isClearingSessionRef.current = true;
      hasLogoutBarrierRef.current = true;
      setBootstrapRecoveryReason(null);
      authStorage.clear();
      resetAnalyticsState();
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
    [invalidateBootstrapRevalidation, resetAnalyticsState, syncOfflineAuthState]
  );

  const login = useCallback(
    (newUser: User) => {
      const sanitizedUser = sanitizeAuthUser(newUser);

      if (!sanitizedUser) {
        clearAuthenticatedState(true);
        return;
      }

      invalidateBootstrapRevalidation();
      authStorage.setUser(sanitizedUser);
      hasLogoutBarrierRef.current = false;
      setBootstrapRecoveryReason(null);
      setUser(sanitizedUser);
      setIsLoading(false);
      syncOfflineAuthState(true);
    },
    [
      clearAuthenticatedState,
      invalidateBootstrapRevalidation,
      syncOfflineAuthState,
    ]
  );

  const logout = useCallback(() => {
    clearAuthenticatedState(true);
  }, [clearAuthenticatedState]);

  const retryBootstrap = useCallback(() => {
    if (
      !authStorage.getUser() ||
      (authTransport.kind === "browser-session" && !isOnline())
    ) {
      setBootstrapRecoveryReason(null);
      setIsLoading(false);
      return;
    }

    setBootstrapRecoveryReason(null);
    setIsLoading(true);
    setBootstrapRetryKey((currentValue) => currentValue + 1);
  }, [authTransport.kind]);

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

  useEffect(() => {
    if (!analytics || !user) {
      return;
    }

    analytics.resumeAuthenticatedSession(String(user.id));
  }, [user]);

  // Bootstrap: revalidate any stored session on app load/refresh when online.
  // Uses getCurrentUser() to confirm the session and clear it if invalid.
  useEffect(() => {
    syncOfflineAuthState(authStorage.getUser() !== null);
  }, [syncOfflineAuthState]);

  useEffect(() => {
    const storedUser = authStorage.getUser();

    if (!storedUser) {
      return;
    }

    if (authTransport.kind === "browser-session" && !isOnline()) {
      return;
    }

    let isActive = true;
    let didTimeout = false;
    let timeoutId: number | null = null;
    const requestVersion = bootstrapRequestVersionRef.current + 1;
    bootstrapRequestVersionRef.current = requestVersion;

    const startBootstrapRevalidation = () => {
      timeoutId = window.setTimeout(() => {
        if (
          !isActive ||
          bootstrapRequestVersionRef.current !== requestVersion ||
          hasLogoutBarrierRef.current
        ) {
          return;
        }

        didTimeout = true;
        setIsLoading(false);
        setBootstrapRecoveryReason("timeout");
        console.warn(
          `Auth bootstrap revalidation exceeded ${BOOTSTRAP_REVALIDATION_TIMEOUT_MS}ms.`
        );
      }, BOOTSTRAP_REVALIDATION_TIMEOUT_MS);

      void authTransport
        .getCurrentUser()
        .then((currentUser) => {
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
          }

          if (
            !isActive ||
            bootstrapRequestVersionRef.current !== requestVersion ||
            hasLogoutBarrierRef.current
          ) {
            return;
          }

          authStorage.setUser(currentUser);
          hasLogoutBarrierRef.current = false;
          setBootstrapRecoveryReason(null);
          setUser(currentUser);
          setIsLoading(false);
          syncOfflineAuthState(true);
        })
        .catch((error: unknown) => {
          if (timeoutId !== null) {
            window.clearTimeout(timeoutId);
          }

          if (
            !isActive ||
            bootstrapRequestVersionRef.current !== requestVersion
          ) {
            return;
          }

          if (isInvalidBootstrapSessionError(error)) {
            clearAuthenticatedState(true);
            return;
          }

          if (isOfflineBootstrapError(error)) {
            setIsLoading(false);
            setBootstrapRecoveryReason(null);
            return;
          }

          console.warn(
            "Auth bootstrap revalidation failed; holding protected routes behind recovery UI.",
            error
          );
          setIsLoading(false);
          setBootstrapRecoveryReason(didTimeout ? "timeout" : "network");
        });
    };

    if (authTransport.kind === "browser-session") {
      startBootstrapRevalidation();
    } else {
      void authTransport.isNetworkAvailable().then((networkAvailable) => {
        if (
          !isActive ||
          bootstrapRequestVersionRef.current !== requestVersion ||
          hasLogoutBarrierRef.current
        ) {
          return;
        }

        if (!networkAvailable) {
          setIsLoading(false);
          return;
        }

        startBootstrapRevalidation();
      });
    }

    return () => {
      isActive = false;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [
    authTransport,
    bootstrapRetryKey,
    clearAuthenticatedState,
    syncOfflineAuthState,
  ]);

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
        const nextUser = authStorage.getUser();

        if (!nextUser) {
          clearAuthenticatedState(true);
          return;
        }

        hasLogoutBarrierRef.current = false;
        setBootstrapRecoveryReason(null);
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

      hasLogoutBarrierRef.current = false;
        setBootstrapRecoveryReason(null);
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
      bootstrapRecoveryReason,
      login,
      logout,
      retryBootstrap,
      hasRole,
      hasPermission,
      hasOrganizationalAccess,
    }),
    [
      user,
      isLoading,
      bootstrapRecoveryReason,
      login,
      logout,
      retryBootstrap,
      hasRole,
      hasPermission,
      hasOrganizationalAccess,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
