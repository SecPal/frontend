// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import {
  AuthContext,
  type AuthBootstrapRecoveryReason,
  type User,
} from "./auth-context";
import { getAuthTransport } from "../services/authTransport";
import { sanitizeAuthUser } from "../services/authState";
import { authStorage } from "../services/storage";
import { sessionEvents, isOnline } from "../services/sessionEvents";
import { clearSensitiveClientState } from "../lib/clientStateCleanup";
import { hasUserPermission } from "../lib/capabilities";
import {
  AUTH_VAULT_LOCK_KEY,
  AUTH_VAULT_STORAGE_KEY,
} from "../lib/offlineVault";
import { syncOfflineSessionAccess } from "../lib/serviceWorkerSession";
import { analytics } from "../lib/analytics";

export const BOOTSTRAP_REVALIDATION_TIMEOUT_MS = 3500;

function isPublicUnauthenticatedRoute(pathname: string): boolean {
  const normalized =
    pathname !== "/" && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return normalized === "/login" || normalized === "/onboarding/complete";
}

function shouldBootstrapBrowserSessionWithoutStoredUser(
  authTransportKind: string,
  hasLogoutBarrier: boolean
): boolean {
  if (authTransportKind !== "browser-session" || hasLogoutBarrier) {
    return false;
  }

  if (!isOnline() || typeof window === "undefined") {
    return false;
  }

  return !isPublicUnauthenticatedRoute(window.location.pathname);
}

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
    if (authStorage.hasVaultLock?.()) {
      return null;
    }

    return authStorage.getUserSnapshot();
  });
  const [isVaultLocked, setIsVaultLocked] = useState(
    () => authStorage.hasVaultLock?.() === true
  );
  const [isLoading, setIsLoading] = useState(() => {
    const hasLogoutBarrier = authStorage.hasLogoutBarrier();

    if (authStorage.hasVaultLock?.()) {
      return false;
    }

    if (!authStorage.hasStoredUser()) {
      return shouldBootstrapBrowserSessionWithoutStoredUser(
        authTransport.kind,
        hasLogoutBarrier
      );
    }

    if (
      authStorage.getUserSnapshot() !== null &&
      authTransport.kind === "browser-session" &&
      !isOnline()
    ) {
      return false;
    }

    return true;
  });
  const [bootstrapRecoveryReason, setBootstrapRecoveryReason] =
    useState<AuthBootstrapRecoveryReason | null>(null);
  const [bootstrapRetryKey, setBootstrapRetryKey] = useState(0);
  const isClearingSessionRef = useRef(false);
  const shouldClearSensitiveStateRef = useRef(false);
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

  const resetAnalyticsState = useCallback(async () => {
    if (!analytics) {
      return;
    }

    try {
      await analytics.resetForLogout();
    } catch (error: unknown) {
      console.warn("Failed to reset analytics state during logout:", error);
    }
  }, []);

  const clearAuthenticatedState = useCallback(
    (clearSensitiveState: boolean) => {
      if (isClearingSessionRef.current) {
        shouldClearSensitiveStateRef.current =
          shouldClearSensitiveStateRef.current || clearSensitiveState;
        return;
      }

      invalidateBootstrapRevalidation();
      isClearingSessionRef.current = true;
      shouldClearSensitiveStateRef.current = clearSensitiveState;
      hasLogoutBarrierRef.current = true;
      setBootstrapRecoveryReason(null);
      const clearAuthStoragePromise = authStorage.clear({
        clearOfflineVaultTables: !shouldClearSensitiveStateRef.current,
      });
      const resetAnalyticsStatePromise = resetAnalyticsState();
      setUser(null);
      setIsVaultLocked(false);
      setIsLoading(false);
      syncOfflineAuthState(false);

      void Promise.allSettled([
        clearAuthStoragePromise,
        resetAnalyticsStatePromise,
      ])
        .then(async () => {
          if (!shouldClearSensitiveStateRef.current) {
            return;
          }

          try {
            await clearSensitiveClientState();
          } catch (error: unknown) {
            console.error(
              "Failed to clear sensitive client state during logout:",
              error
            );
          }
        })
        .finally(() => {
          shouldClearSensitiveStateRef.current = false;
          isClearingSessionRef.current = false;
        });
    },
    [invalidateBootstrapRevalidation, resetAnalyticsState, syncOfflineAuthState]
  );

  const login = useCallback(
    async (newUser: User) => {
      const sanitizedUser = sanitizeAuthUser(newUser);

      if (!sanitizedUser) {
        clearAuthenticatedState(true);
        return;
      }

      invalidateBootstrapRevalidation();
      await authStorage.setUser(sanitizedUser);
      hasLogoutBarrierRef.current = false;
      setBootstrapRecoveryReason(null);
      setUser(sanitizedUser);
      setIsVaultLocked(false);
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

  const lock = useCallback(() => {
    authStorage.lockVault?.();
    invalidateBootstrapRevalidation();
    setBootstrapRecoveryReason(null);
    setUser(null);
    setIsVaultLocked(true);
    setIsLoading(false);
    syncOfflineAuthState(false);
  }, [invalidateBootstrapRevalidation, syncOfflineAuthState]);

  const unlock = useCallback(async (): Promise<boolean> => {
    setIsLoading(true);

    try {
      const restoredUser = await authStorage.unlockVault?.();

      if (!restoredUser) {
        clearAuthenticatedState(true);
        return false;
      }

      hasLogoutBarrierRef.current = false;
      setBootstrapRecoveryReason(null);
      setUser(restoredUser);
      setIsVaultLocked(false);
      setIsLoading(false);
      syncOfflineAuthState(true);
      return true;
    } catch (error) {
      console.error("Failed to unlock offline vault:", error);
      clearAuthenticatedState(true);
      return false;
    }
  }, [clearAuthenticatedState, syncOfflineAuthState]);

  const retryBootstrap = useCallback(() => {
    if (!user || (authTransport.kind === "browser-session" && !isOnline())) {
      setBootstrapRecoveryReason(null);
      setIsLoading(false);
      return;
    }

    setBootstrapRecoveryReason(null);
    setIsLoading(true);
    setBootstrapRetryKey((currentValue) => currentValue + 1);
  }, [authTransport.kind, user]);

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
    let isActive = true;
    let didTimeout = false;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    const requestVersion = bootstrapRequestVersionRef.current + 1;
    bootstrapRequestVersionRef.current = requestVersion;
    const snapshotUser = authStorage.getUserSnapshot();

    if (
      snapshotUser &&
      authTransport.kind === "browser-session" &&
      !isOnline()
    ) {
      syncOfflineAuthState(true);
      return;
    }

    const startBootstrapRevalidation = () => {
      timeoutId = globalThis.setTimeout(() => {
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
        .then(async (currentUser) => {
          if (timeoutId !== null) {
            globalThis.clearTimeout(timeoutId);
          }

          if (
            !isActive ||
            bootstrapRequestVersionRef.current !== requestVersion ||
            hasLogoutBarrierRef.current
          ) {
            return;
          }

          await authStorage.setUser(currentUser);

          if (hasLogoutBarrierRef.current) {
            void authStorage.removeUser();
            return;
          }

          if (
            !isActive ||
            bootstrapRequestVersionRef.current !== requestVersion ||
            hasLogoutBarrierRef.current
          ) {
            return;
          }

          hasLogoutBarrierRef.current = false;
          setBootstrapRecoveryReason(null);
          setUser(currentUser);
          setIsLoading(false);
          syncOfflineAuthState(true);
        })
        .catch((error: unknown) => {
          if (timeoutId !== null) {
            globalThis.clearTimeout(timeoutId);
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

    const restoreAndRevalidate = async () => {
      if (authStorage.hasVaultLock?.()) {
        setBootstrapRecoveryReason(null);
        setUser(null);
        setIsVaultLocked(true);
        setIsLoading(false);
        syncOfflineAuthState(false);
        return;
      }

      const hadStoredUser = authStorage.hasStoredUser();
      const storedUser = await authStorage.getUser();

      if (!isActive || bootstrapRequestVersionRef.current !== requestVersion) {
        return;
      }

      if (!storedUser) {
        if (authTransport.kind === "browser-session" && hadStoredUser) {
          if (!isOnline()) {
            setBootstrapRecoveryReason(null);
            setUser(null);
            setIsLoading(false);
            syncOfflineAuthState(false);
            return;
          }

          startBootstrapRevalidation();
          return;
        }

        if (
          shouldBootstrapBrowserSessionWithoutStoredUser(
            authTransport.kind,
            hasLogoutBarrierRef.current
          )
        ) {
          startBootstrapRevalidation();
          return;
        }

        setBootstrapRecoveryReason(null);
        setUser(null);
        setIsLoading(false);
        syncOfflineAuthState(false);
        return;
      }

      hasLogoutBarrierRef.current = false;
      setBootstrapRecoveryReason(null);
      setUser(storedUser);
      setIsVaultLocked(false);
      syncOfflineAuthState(true);

      if (authTransport.kind === "browser-session") {
        if (!isOnline()) {
          setIsLoading(false);
          return;
        }

        startBootstrapRevalidation();
        return;
      }

      const networkAvailable = await authTransport.isNetworkAvailable();

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
    };

    void restoreAndRevalidate().catch((error: unknown) => {
      if (!isActive || bootstrapRequestVersionRef.current !== requestVersion) {
        return;
      }

      console.error("Failed to restore persisted auth state:", error);
      clearAuthenticatedState(false);
    });

    return () => {
      isActive = false;
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
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
      if (event.storageArea !== localStorage) {
        return;
      }

      if (event.key === "auth_logout_barrier" && event.newValue !== null) {
        clearAuthenticatedState(true);
        return;
      }

      if (event.key === AUTH_VAULT_LOCK_KEY) {
        if (event.newValue !== null) {
          invalidateBootstrapRevalidation();
          setBootstrapRecoveryReason(null);
          setUser(null);
          setIsVaultLocked(true);
          setIsLoading(false);
          syncOfflineAuthState(false);
          return;
        }

        void (async () => {
          try {
            const unlockedUser = await authStorage.unlockVault?.();

            if (!unlockedUser) {
              clearAuthenticatedState(true);
              return;
            }

            hasLogoutBarrierRef.current = false;
            setBootstrapRecoveryReason(null);
            invalidateBootstrapRevalidation();
            setUser(unlockedUser);
            setIsVaultLocked(false);
            setIsLoading(false);
            syncOfflineAuthState(true);
          } catch (error) {
            console.error("Failed to unlock cross-tab auth vault:", error);
            clearAuthenticatedState(true);
          }
        })();
      }

      if (event.key !== "auth_user" && event.key !== AUTH_VAULT_STORAGE_KEY) {
        return;
      }

      if (
        event.newValue === null &&
        localStorage.getItem("auth_user") === null &&
        localStorage.getItem(AUTH_VAULT_STORAGE_KEY) === null
      ) {
        clearAuthenticatedState(true);
        return;
      }

      void (async () => {
        try {
          const nextUser = await authStorage.getUser();

          // Re-check the in-memory barrier after the async decrypt because
          // an inflight setUser() from bootstrap may have already cleared the
          // localStorage barrier (via clearLogoutBarrier()) before we got
          // here.
          if (hasLogoutBarrierRef.current) {
            void authStorage.removeUser();
            return;
          }

          if (!nextUser) {
            clearAuthenticatedState(true);
            return;
          }

          hasLogoutBarrierRef.current = false;
          setBootstrapRecoveryReason(null);
          invalidateBootstrapRevalidation();
          setUser(nextUser);
          setIsVaultLocked(false);
          setIsLoading(false);
          syncOfflineAuthState(true);
        } catch (error) {
          console.error("Failed to parse cross-tab auth state:", error);
          clearAuthenticatedState(true);
        }
      })();
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

      void (async () => {
        if (authStorage.hasVaultLock?.()) {
          setBootstrapRecoveryReason(null);
          setUser(null);
          setIsVaultLocked(true);
          setIsLoading(false);
          syncOfflineAuthState(false);
          return;
        }

        const storedUser = await authStorage.getUser();

        // Re-check the in-memory barrier after the async decrypt.
        if (hasLogoutBarrierRef.current) {
          void authStorage.removeUser();
          return;
        }

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
        setIsVaultLocked(false);
        setIsLoading(false);
        syncOfflineAuthState(true);
      })();
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
      // user and authStorage are kept in sync via login/logout/bootstrap flows.
      if (user) {
        clearAuthenticatedState(true);
      }
    });

    return unsubscribe;
  }, [clearAuthenticatedState, user]);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      bootstrapRecoveryReason,
      login,
      logout,
      lock,
      unlock,
      retryBootstrap,
      hasPermission,
      hasOrganizationalAccess,
      isVaultLocked,
    }),
    [
      user,
      isLoading,
      bootstrapRecoveryReason,
      login,
      logout,
      lock,
      unlock,
      retryBootstrap,
      hasPermission,
      hasOrganizationalAccess,
      isVaultLocked,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
