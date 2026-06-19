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
import { fetchCsrfToken, getCsrfTokenFromCookie } from "../services/csrf";
import { sessionEvents, isOnline } from "../services/sessionEvents";
import { clearSensitiveClientState } from "../lib/clientStateCleanup";
import { hasUserPermission } from "../lib/capabilities";
import { syncOfflineSessionAccess } from "../lib/serviceWorkerSession";
import { resetPrefetchCache } from "../hooks/usePrefetch";
import {
  AUTH_VAULT_STORAGE_KEY,
  AUTH_VAULT_LOCK_KEY,
} from "../lib/offlineVaultKeys";

export const BOOTSTRAP_REVALIDATION_TIMEOUT_MS = 3500;

async function loadOfflineVaultModule() {
  return await import("../lib/offlineVault");
}

async function loadAnalyticsModule() {
  return await import("../lib/analytics");
}

function isPublicUnauthenticatedRoute(pathname: string): boolean {
  const normalized =
    pathname !== "/" && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;
  return normalized === "/onboarding/complete";
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

  const normalizedPathname =
    window.location.pathname !== "/" && window.location.pathname.endsWith("/")
      ? window.location.pathname.slice(0, -1)
      : window.location.pathname;

  if (normalizedPathname === "/login") {
    return getCsrfTokenFromCookie() !== null;
  }

  if (isPublicUnauthenticatedRoute(window.location.pathname)) {
    return false;
  }

  return getCsrfTokenFromCookie() !== null;
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

function getBootstrapErrorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error)) {
    return null;
  }

  const status = (error as { status?: unknown }).status;

  return typeof status === "number" && Number.isFinite(status) ? status : null;
}

function isInvalidBootstrapSessionError(error: unknown): boolean {
  const status = getBootstrapErrorStatus(error);

  if (status === 401) {
    return true;
  }

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

function isRetriableBootstrapError(error: unknown): boolean {
  const status = getBootstrapErrorStatus(error);

  if (status !== null) {
    return status === 408 || status === 429 || status >= 500;
  }

  const code = getBootstrapErrorCode(error)?.toUpperCase();

  if (code === "NETWORK_ERROR") {
    return true;
  }

  if (code?.startsWith("HTTP_")) {
    const statusFromCode = Number.parseInt(code.slice("HTTP_".length), 10);

    return (
      Number.isFinite(statusFromCode) &&
      (statusFromCode === 408 ||
        statusFromCode === 429 ||
        statusFromCode >= 500)
    );
  }

  const message = getBootstrapErrorMessage(error).toLowerCase();

  if (
    message.includes("failed to fetch") ||
    message.includes("load failed") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("timeout") ||
    message.includes("timed out")
  ) {
    return true;
  }

  // At this point every known retriable signal (HTTP status, HTTP_ code,
  // network-error message) has been checked and not matched. A generic Error
  // (e.g. "Network down" from a transport library) is treated as potentially
  // transient and allowed to retry once. Deterministic client/configuration
  // failures should not retry.
  return !(
    error instanceof Error &&
    (error.name === "AuthApiError" ||
      error.name === "ApiBaseUrlConfigurationError")
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
  const clearAuthenticatedStatePromiseRef = useRef<Promise<void>>(
    Promise.resolve()
  );
  const shouldClearSensitiveStateRef = useRef(false);
  const shouldRedirectOpenClientsRef = useRef(false);
  const shouldSkipBarrierVaultTableCleanupRef = useRef(false);
  const sensitiveLogoutBarrierCleanupOwnerTokenRef = useRef<string | null>(
    null
  );
  const bootstrapRequestVersionRef = useRef(0);
  const hasAutomaticallyRetriedBootstrapRef = useRef(false);
  const hasLogoutBarrierRef = useRef(authStorage.hasLogoutBarrier());

  const invalidateBootstrapRevalidation = useCallback(() => {
    bootstrapRequestVersionRef.current += 1;
  }, []);

  const syncOfflineAuthState = useCallback(
    (
      shouldAllowOfflineSessionAccess: boolean,
      options?: { redirectOpenClients?: boolean }
    ) => {
      const syncPromise =
        options === undefined
          ? syncOfflineSessionAccess(shouldAllowOfflineSessionAccess)
          : syncOfflineSessionAccess(shouldAllowOfflineSessionAccess, options);

      void syncPromise.catch((error: unknown) => {
        console.warn("Failed to synchronize offline auth state:", error);
      });
    },
    []
  );

  const resetAnalyticsState = useCallback(async () => {
    try {
      const { analytics } = await loadAnalyticsModule();

      if (!analytics) {
        return;
      }

      await analytics.resetForLogout();
    } catch (error: unknown) {
      console.warn("Failed to reset analytics state during logout:", error);
    }
  }, []);

  const persistAuthenticatedUser = useCallback(
    async (nextUser: User) => {
      if (
        authTransport.kind === "browser-session" &&
        getCsrfTokenFromCookie() === null
      ) {
        await fetchCsrfToken();
        const { rememberCurrentAuthVaultKeyMaterial } =
          await loadOfflineVaultModule();
        rememberCurrentAuthVaultKeyMaterial();
      }

      await authStorage.setUser(nextUser);
    },
    [authTransport.kind]
  );

  const beginSensitiveLogoutBarrierCleanup = useCallback(() => {
    if (sensitiveLogoutBarrierCleanupOwnerTokenRef.current !== null) {
      return;
    }

    sensitiveLogoutBarrierCleanupOwnerTokenRef.current =
      authStorage.beginSensitiveLogoutBarrierCleanup();
  }, []);

  const endSensitiveLogoutBarrierCleanup = useCallback(() => {
    if (sensitiveLogoutBarrierCleanupOwnerTokenRef.current === null) {
      return;
    }

    authStorage.endSensitiveLogoutBarrierCleanup(
      sensitiveLogoutBarrierCleanupOwnerTokenRef.current
    );
    sensitiveLogoutBarrierCleanupOwnerTokenRef.current = null;
  }, []);

  const syncBarrierStateFromStorage = useCallback(() => {
    if (!authStorage.hasLogoutBarrier()) {
      return false;
    }

    hasLogoutBarrierRef.current = true;
    shouldSkipBarrierVaultTableCleanupRef.current =
      shouldSkipBarrierVaultTableCleanupRef.current ||
      authStorage.shouldSkipBarrierVaultTableCleanup();

    return true;
  }, []);

  const removeUserForActiveBarrier = useCallback(() => {
    const shouldSkipBarrierVaultTableCleanup =
      shouldSkipBarrierVaultTableCleanupRef.current ||
      authStorage.shouldSkipBarrierVaultTableCleanup();

    shouldSkipBarrierVaultTableCleanupRef.current =
      shouldSkipBarrierVaultTableCleanup;

    void authStorage.removeUser({
      clearOfflineVaultTables: !shouldSkipBarrierVaultTableCleanup,
      allowBarrierSkipUpgrade: true,
    });
  }, []);

  const reconcileActiveBarrierState = useCallback(() => {
    syncBarrierStateFromStorage();
    invalidateBootstrapRevalidation();
    setBootstrapRecoveryReason(null);
    setUser(null);
    setIsVaultLocked(false);
    setIsLoading(false);
    syncOfflineAuthState(false, { redirectOpenClients: true });
    removeUserForActiveBarrier();
  }, [
    invalidateBootstrapRevalidation,
    removeUserForActiveBarrier,
    syncBarrierStateFromStorage,
    syncOfflineAuthState,
  ]);

  const clearAuthenticatedState = useCallback(
    (
      clearSensitiveState: boolean,
      options?: { redirectOpenClients?: boolean }
    ) => {
      if (isClearingSessionRef.current) {
        const shouldUpgradeSensitiveState =
          clearSensitiveState && !shouldClearSensitiveStateRef.current;
        const shouldUpgradeRedirectOpenClients =
          options?.redirectOpenClients === true &&
          !shouldRedirectOpenClientsRef.current;

        shouldClearSensitiveStateRef.current =
          shouldClearSensitiveStateRef.current || clearSensitiveState;
        shouldRedirectOpenClientsRef.current =
          shouldRedirectOpenClientsRef.current ||
          options?.redirectOpenClients === true;
        shouldSkipBarrierVaultTableCleanupRef.current =
          shouldSkipBarrierVaultTableCleanupRef.current || clearSensitiveState;

        if (shouldUpgradeSensitiveState) {
          beginSensitiveLogoutBarrierCleanup();
        }

        if (shouldUpgradeRedirectOpenClients) {
          syncOfflineAuthState(false, { redirectOpenClients: true });
        }

        return;
      }

      invalidateBootstrapRevalidation();
      isClearingSessionRef.current = true;
      shouldClearSensitiveStateRef.current = clearSensitiveState;
      shouldRedirectOpenClientsRef.current =
        options?.redirectOpenClients === true;
      shouldSkipBarrierVaultTableCleanupRef.current = clearSensitiveState;

      if (clearSensitiveState) {
        // Drop prefetch warm-up state on every full session teardown
        // (explicit logout, `session:expired` 401, invalid-payload recovery,
        // cross-tab logout, ...). Otherwise `completedPrefetches` keys from
        // the previous user keep suppressing prefetches for the next user
        // who signs in, weakening the cross-session isolation introduced
        // alongside the prefetch epoch counter in usePrefetch.ts.
        resetPrefetchCache();
        beginSensitiveLogoutBarrierCleanup();
      }

      hasLogoutBarrierRef.current = true;
      setBootstrapRecoveryReason(null);
      const clearAuthStoragePromise = authStorage.clear({
        clearOfflineVaultTables: !shouldSkipBarrierVaultTableCleanupRef.current,
      });
      const resetAnalyticsStatePromise = resetAnalyticsState();
      setUser(null);
      setIsVaultLocked(false);
      setIsLoading(false);
      syncOfflineAuthState(false, {
        redirectOpenClients: shouldRedirectOpenClientsRef.current,
      });

      clearAuthenticatedStatePromiseRef.current = Promise.allSettled([
        clearAuthStoragePromise,
        resetAnalyticsStatePromise,
      ])
        .then(async () => {
          if (!shouldClearSensitiveStateRef.current) {
            return;
          }

          try {
            await authStorage.waitForInFlightVaultTableCleanup();
          } catch (error: unknown) {
            console.warn(
              "Failed while waiting for in-flight vault cleanup during logout:",
              error
            );
          }

          try {
            await clearSensitiveClientState();
          } catch (error: unknown) {
            console.error(
              "Failed to clear sensitive client state during logout:",
              error
            );
          } finally {
            endSensitiveLogoutBarrierCleanup();
          }
        })
        .finally(() => {
          shouldSkipBarrierVaultTableCleanupRef.current = false;
          shouldClearSensitiveStateRef.current = false;
          shouldRedirectOpenClientsRef.current = false;
          isClearingSessionRef.current = false;
          clearAuthenticatedStatePromiseRef.current = Promise.resolve();
        });
    },
    [
      beginSensitiveLogoutBarrierCleanup,
      endSensitiveLogoutBarrierCleanup,
      invalidateBootstrapRevalidation,
      resetAnalyticsState,
      syncOfflineAuthState,
    ]
  );

  const login = useCallback(
    async (newUser: User) => {
      const sanitizedUser = sanitizeAuthUser(newUser);

      if (!sanitizedUser) {
        clearAuthenticatedState(true);
        return;
      }

      invalidateBootstrapRevalidation();
      await persistAuthenticatedUser(sanitizedUser);
      hasLogoutBarrierRef.current = false;
      shouldSkipBarrierVaultTableCleanupRef.current = false;
      setBootstrapRecoveryReason(null);
      setUser(sanitizedUser);
      setIsVaultLocked(false);
      setIsLoading(false);
      syncOfflineAuthState(true);
    },
    [
      clearAuthenticatedState,
      invalidateBootstrapRevalidation,
      persistAuthenticatedUser,
      syncOfflineAuthState,
    ]
  );

  const logout = useCallback(async () => {
    // `clearAuthenticatedState(true)` resets the prefetch cache for us as
    // part of every full-teardown path; no separate `resetPrefetchCache()`
    // call is needed here.
    clearAuthenticatedState(true, { redirectOpenClients: true });
    await clearAuthenticatedStatePromiseRef.current;
  }, [clearAuthenticatedState]);

  const lock = useCallback(() => {
    authStorage.lockVault?.();
    invalidateBootstrapRevalidation();
    setBootstrapRecoveryReason(null);
    setUser(null);
    setIsVaultLocked(true);
    setIsLoading(false);
    // Vault lock is a recoverable local state, so keep offline session access enabled.
    syncOfflineAuthState(true);
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
      shouldSkipBarrierVaultTableCleanupRef.current = false;
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
    if (authTransport.kind === "browser-session") {
      if (!isOnline()) {
        setBootstrapRecoveryReason(null);
        setIsLoading(false);
        return;
      }

      hasAutomaticallyRetriedBootstrapRef.current = false;
      setBootstrapRecoveryReason(null);
      setIsLoading(true);
      setBootstrapRetryKey((currentValue) => currentValue + 1);
      return;
    }

    if (!user) {
      setBootstrapRecoveryReason(null);
      setIsLoading(false);
      return;
    }

    hasAutomaticallyRetriedBootstrapRef.current = false;
    setBootstrapRecoveryReason(null);
    setIsLoading(true);
    setBootstrapRetryKey((currentValue) => currentValue + 1);
  }, [authTransport.kind, user]);

  const revalidateBrowserSessionAfterStorageMismatch = useCallback(() => {
    if (
      authTransport.kind === "browser-session" &&
      isOnline() &&
      shouldBootstrapBrowserSessionWithoutStoredUser(authTransport.kind, false)
    ) {
      hasLogoutBarrierRef.current = false;
      shouldSkipBarrierVaultTableCleanupRef.current = false;
      hasAutomaticallyRetriedBootstrapRef.current = false;
      invalidateBootstrapRevalidation();
      setBootstrapRecoveryReason(null);
      setIsVaultLocked(false);
      setIsLoading(true);
      setBootstrapRetryKey((currentValue) => currentValue + 1);
      return;
    }

    hasLogoutBarrierRef.current = false;
    shouldSkipBarrierVaultTableCleanupRef.current = false;
    setBootstrapRecoveryReason(null);
    setUser(null);
    setIsVaultLocked(false);
    setIsLoading(false);
    syncOfflineAuthState(false);
  }, [
    authTransport.kind,
    invalidateBootstrapRevalidation,
    syncOfflineAuthState,
  ]);

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
    if (!user) {
      return;
    }

    void loadAnalyticsModule()
      .then(({ analytics }) => {
        analytics?.resumeAuthenticatedSession(String(user.id));
      })
      .catch((error: unknown) => {
        console.warn(
          "Failed to resume analytics for authenticated session:",
          error
        );
      });
  }, [user]);

  // Bootstrap: revalidate any stored session on app load/refresh when online.
  // Uses getCurrentUser() to confirm the session and clear it if invalid.
  useEffect(() => {
    let isActive = true;
    let didTimeout = false;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    const requestVersion = bootstrapRequestVersionRef.current + 1;
    bootstrapRequestVersionRef.current = requestVersion;

    const startBootstrapRevalidation = (
      clearSensitiveStateOnInvalidSession: boolean
    ) => {
      const retryBootstrapAutomatically = () => {
        invalidateBootstrapRevalidation();
        hasAutomaticallyRetriedBootstrapRef.current = true;
        setBootstrapRecoveryReason(null);
        setIsLoading(true);
        setBootstrapRetryKey((currentValue) => currentValue + 1);
      };

      timeoutId = globalThis.setTimeout(() => {
        if (
          !isActive ||
          bootstrapRequestVersionRef.current !== requestVersion ||
          hasLogoutBarrierRef.current
        ) {
          return;
        }

        didTimeout = true;
        if (!hasAutomaticallyRetriedBootstrapRef.current) {
          retryBootstrapAutomatically();
          return;
        }

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

          await persistAuthenticatedUser(currentUser);

          if (hasLogoutBarrierRef.current || syncBarrierStateFromStorage()) {
            reconcileActiveBarrierState();
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
          shouldSkipBarrierVaultTableCleanupRef.current = false;
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
            if (!clearSensitiveStateOnInvalidSession) {
              hasLogoutBarrierRef.current = false;
              shouldSkipBarrierVaultTableCleanupRef.current = false;
              setBootstrapRecoveryReason(null);
              setUser(null);
              setIsVaultLocked(false);
              setIsLoading(false);
              syncOfflineAuthState(false);
              return;
            }

            clearAuthenticatedState(clearSensitiveStateOnInvalidSession, {
              redirectOpenClients: false,
            });
            return;
          }

          if (isOfflineBootstrapError(error)) {
            setIsLoading(false);
            setBootstrapRecoveryReason(null);
            return;
          }

          if (!isRetriableBootstrapError(error)) {
            console.warn(
              "Auth bootstrap revalidation failed with a non-retriable response; holding protected routes behind recovery UI.",
              error
            );
            setIsLoading(false);
            setBootstrapRecoveryReason("network");
            return;
          }

          if (!hasAutomaticallyRetriedBootstrapRef.current) {
            retryBootstrapAutomatically();
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
        syncOfflineAuthState(true);
        return;
      }

      const hadStoredUser = authStorage.hasStoredUser();
      const storedUser = await authStorage.getUser();

      if (!isActive || bootstrapRequestVersionRef.current !== requestVersion) {
        return;
      }

      if (hasLogoutBarrierRef.current || syncBarrierStateFromStorage()) {
        reconcileActiveBarrierState();
        return;
      }

      if (!storedUser) {
        const shouldBootstrapWithoutStoredUser =
          shouldBootstrapBrowserSessionWithoutStoredUser(
            authTransport.kind,
            hasLogoutBarrierRef.current
          );

        if (authTransport.kind === "browser-session" && hadStoredUser) {
          if (!isOnline()) {
            setBootstrapRecoveryReason(null);
            setUser(null);
            setIsLoading(false);
            syncOfflineAuthState(false);
            return;
          }

          if (shouldBootstrapWithoutStoredUser) {
            startBootstrapRevalidation(true);
            return;
          }
        }

        if (shouldBootstrapWithoutStoredUser) {
          startBootstrapRevalidation(false);
          return;
        }

        setBootstrapRecoveryReason(null);
        setUser(null);
        setIsLoading(false);
        syncOfflineAuthState(false);
        return;
      }

      hasLogoutBarrierRef.current = false;
      shouldSkipBarrierVaultTableCleanupRef.current = false;
      setBootstrapRecoveryReason(null);
      setUser(storedUser);
      setIsVaultLocked(false);
      syncOfflineAuthState(true);

      if (authTransport.kind === "browser-session") {
        if (!isOnline()) {
          setIsLoading(false);
          return;
        }

        startBootstrapRevalidation(true);
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

      startBootstrapRevalidation(true);
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
    invalidateBootstrapRevalidation,
    persistAuthenticatedUser,
    reconcileActiveBarrierState,
    syncBarrierStateFromStorage,
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
          syncOfflineAuthState(true);
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
            shouldSkipBarrierVaultTableCleanupRef.current = false;
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
        revalidateBrowserSessionAfterStorageMismatch();
        return;
      }

      if (
        event.key === AUTH_VAULT_STORAGE_KEY &&
        event.newValue !== null &&
        authStorage.hasVaultLock?.()
      ) {
        void loadOfflineVaultModule().then(
          ({ rememberCurrentAuthVaultKeyMaterial }) => {
            rememberCurrentAuthVaultKeyMaterial();
          }
        );
        invalidateBootstrapRevalidation();
        setBootstrapRecoveryReason(null);
        setUser(null);
        setIsVaultLocked(true);
        setIsLoading(false);
        syncOfflineAuthState(true);
        return;
      }

      // Stop any startup restore/revalidation that may have observed this
      // storage write before the cross-tab storage handler adopts it.
      invalidateBootstrapRevalidation();

      void (async () => {
        try {
          const nextUser = await authStorage.getUser();

          // Re-check the in-memory barrier after the async decrypt because
          // an inflight setUser() from bootstrap may have already cleared the
          // localStorage barrier (via clearLogoutBarrier()) before we got
          // here.
          if (hasLogoutBarrierRef.current || syncBarrierStateFromStorage()) {
            reconcileActiveBarrierState();
            return;
          }

          if (!nextUser) {
            revalidateBrowserSessionAfterStorageMismatch();
            return;
          }

          hasLogoutBarrierRef.current = false;
          shouldSkipBarrierVaultTableCleanupRef.current = false;
          setBootstrapRecoveryReason(null);
          setUser(nextUser);
          setIsVaultLocked(false);
          setIsLoading(false);
          syncOfflineAuthState(true);
        } catch (error) {
          console.error("Failed to parse cross-tab auth state:", error);
          revalidateBrowserSessionAfterStorageMismatch();
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
    revalidateBrowserSessionAfterStorageMismatch,
    reconcileActiveBarrierState,
    syncBarrierStateFromStorage,
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
          syncOfflineAuthState(true);
          return;
        }

        const storedUser = await authStorage.getUser();

        // Re-check the in-memory barrier after the async decrypt.
        if (hasLogoutBarrierRef.current || syncBarrierStateFromStorage()) {
          reconcileActiveBarrierState();
          return;
        }

        if (!storedUser) {
          if (user) {
            clearAuthenticatedState(false);
          }

          return;
        }

        hasLogoutBarrierRef.current = false;
        shouldSkipBarrierVaultTableCleanupRef.current = false;
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
    reconcileActiveBarrierState,
    syncBarrierStateFromStorage,
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
