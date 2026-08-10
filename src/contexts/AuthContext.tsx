// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

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
import { NATIVE_AUTH_LOGOUT_EVENT_NAME } from "../services/nativeAuthEvents";
import {
  AuthUserPersistenceError,
  authStorage,
  type AuthStorageWriteOptions,
  type AuthUserPersistenceResult,
  type AuthVaultUnlockResult,
} from "../services/storage";
import { fetchCsrfToken, getCsrfTokenFromCookie } from "../services/csrf";
import { sessionEvents, isOnline } from "../services/sessionEvents";
import {
  clearBrowserPushClientState,
  clearDestructiveSensitiveClientState,
} from "../lib/clientStateCleanup";
import { hasUserPermission } from "../lib/capabilities";
import { isRecoverableLazyModuleError } from "../lib/lazyModuleErrors";
import { syncOfflineSessionAccess } from "../lib/serviceWorkerSession";
import { resetPrefetchCache } from "../hooks/usePrefetch";
import {
  AUTH_USER_REVALIDATION_REQUIRED_KEY,
  AUTH_VAULT_STORAGE_KEY,
  AUTH_VAULT_LOCK_KEY,
} from "../lib/offlineVaultKeys";
import { getSensitiveUiState } from "../lib/sensitiveUiState";

export const BOOTSTRAP_REVALIDATION_TIMEOUT_MS = 3500;
const AUTH_LOGOUT_CLEANUP_WAIT_TIMEOUT_MS = 5_000;
const AUTH_LOGIN_AFTER_LOGOUT_CLEANUP_WAIT_TIMEOUT_MS = 5_000;

async function isNetworkAvailableWithinBootstrapTimeout(
  isNetworkAvailable: () => Promise<boolean>
): Promise<boolean> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  try {
    return await Promise.race([
      isNetworkAvailable(),
      new Promise<boolean>((resolve) => {
        timeoutId = globalThis.setTimeout(
          () => resolve(false),
          BOOTSTRAP_REVALIDATION_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

async function readStoredUserWithinBootstrapTimeout(): Promise<
  { status: "completed"; user: User | null } | { status: "timed-out" }
> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  try {
    return await Promise.race([
      authStorage.getUser({ signal: controller.signal }).then((user) => ({
        status: "completed" as const,
        user,
      })),
      new Promise<{ status: "timed-out" }>((resolve) => {
        timeoutId = globalThis.setTimeout(() => {
          resolve({ status: "timed-out" });
          controller.abort();
        }, BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

async function loadOfflineVaultModule() {
  return await import("../lib/offlineVault");
}

async function loadAnalyticsModule() {
  return await import("../lib/analytics");
}

async function waitForLogoutCleanupWithTimeout(
  operation: Promise<void>,
  warningMessage: string,
  timeoutMs: number = AUTH_LOGOUT_CLEANUP_WAIT_TIMEOUT_MS
): Promise<void> {
  let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;

  try {
    const result = await Promise.race([
      operation.then(() => "completed" as const),
      new Promise<"timed-out">((resolve) => {
        timeoutId = globalThis.setTimeout(() => {
          resolve("timed-out");
        }, timeoutMs);
      }),
    ]);

    if (result === "timed-out") {
      console.warn(warningMessage);
    }
  } finally {
    if (timeoutId !== null) {
      globalThis.clearTimeout(timeoutId);
    }
  }
}

function isPublicUnauthenticatedRoute(pathname: string): boolean {
  const normalized =
    pathname !== "/" && pathname.endsWith("/")
      ? pathname.slice(0, -1)
      : pathname;

  return normalized === "/onboarding/complete" || normalized === "/source";
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

  if (normalizedPathname === "/login" || normalizedPathname === "/source") {
    return getCsrfTokenFromCookie() !== null;
  }

  if (isPublicUnauthenticatedRoute(normalizedPathname)) {
    return false;
  }

  return true;
}

function shouldBootstrapSessionWithoutStoredUser(
  authTransportKind: string,
  hasLogoutBarrier: boolean
): boolean {
  return authTransportKind === "native-bridge"
    ? !hasLogoutBarrier
    : shouldBootstrapBrowserSessionWithoutStoredUser(
        authTransportKind,
        hasLogoutBarrier
      );
}

function shouldTreatBootstrapFailureWithoutStoredUserAsLoggedOut(
  clearSensitiveStateOnInvalidSession: boolean,
  authTransportKind: string
): boolean {
  return (
    authTransportKind === "browser-session" &&
    !clearSensitiveStateOnInvalidSession &&
    getCsrfTokenFromCookie() === null
  );
}

function createConfirmedBootstrapSessionError(error: unknown): Error {
  const wrappedError =
    error instanceof Error
      ? error
      : new Error("Persisting confirmed bootstrap session failed.");
  Object.defineProperty(wrappedError, "__confirmedBootstrapSession", {
    value: true,
    configurable: true,
  });
  return wrappedError;
}

function isConfirmedBootstrapSessionError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "__confirmedBootstrapSession" in error &&
    (error as { __confirmedBootstrapSession?: unknown })
      .__confirmedBootstrapSession === true
  );
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
  const [user, setUser] = useState<User | null>(null);
  const [isVaultLocked, setIsVaultLocked] = useState(
    () => authStorage.hasVaultLock?.() === true
  );
  const [isPrivacyShielded, setIsPrivacyShielded] = useState(false);
  const [isLoading, setIsLoading] = useState(() => {
    const hasLogoutBarrier = authStorage.hasLogoutBarrier();

    if (authStorage.hasVaultLock?.()) {
      return false;
    }

    if (!authStorage.hasStoredUser()) {
      return shouldBootstrapSessionWithoutStoredUser(
        authTransport.kind,
        hasLogoutBarrier
      );
    }

    return true;
  });
  const [bootstrapRecoveryReason, setBootstrapRecoveryReason] =
    useState<AuthBootstrapRecoveryReason | null>(null);
  const [bootstrapRetryKey, setBootstrapRetryKey] = useState(0);
  const isClearingSessionRef = useRef(false);
  const clearSessionCycleRef = useRef(0);
  const clearAuthenticatedStateDestructivePromiseRef = useRef<Promise<void>>(
    Promise.resolve()
  );
  const clearAuthenticatedStateCompletionPromiseRef = useRef<Promise<void>>(
    Promise.resolve()
  );
  const shouldClearSensitiveStateRef = useRef(false);
  const shouldResetPrefetchCacheAfterStorageMismatchRef = useRef(false);
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
    async (
      nextUser: User,
      options: AuthStorageWriteOptions = {}
    ): Promise<AuthUserPersistenceResult> => {
      const revalidationOwnerToken =
        authStorage.getUserRevalidationOwnerToken();

      if (
        authTransport.kind === "browser-session" &&
        getCsrfTokenFromCookie() === null
      ) {
        await fetchCsrfToken();
        const { rememberCurrentAuthVaultKeyMaterial } =
          await loadOfflineVaultModule();
        rememberCurrentAuthVaultKeyMaterial();
      }

      const persistenceResult = await authStorage.setUser(nextUser, options);

      if (persistenceResult.status === "persisted") {
        authStorage.completeUserRevalidation(revalidationOwnerToken);
      }

      return persistenceResult;
    },
    [authTransport.kind]
  );

  const beginSensitiveLogoutBarrierCleanup = useCallback(() => {
    if (sensitiveLogoutBarrierCleanupOwnerTokenRef.current !== null) {
      return sensitiveLogoutBarrierCleanupOwnerTokenRef.current;
    }

    sensitiveLogoutBarrierCleanupOwnerTokenRef.current =
      authStorage.beginSensitiveLogoutBarrierCleanup();

    return sensitiveLogoutBarrierCleanupOwnerTokenRef.current;
  }, []);

  const endSensitiveLogoutBarrierCleanup = useCallback(
    (ownerToken?: string | null) => {
      const activeOwnerToken =
        ownerToken ?? sensitiveLogoutBarrierCleanupOwnerTokenRef.current;

      if (activeOwnerToken === null) {
        return;
      }

      authStorage.completeStaleSensitiveLogoutBarrierCleanup(activeOwnerToken);
      authStorage.endSensitiveLogoutBarrierCleanup(activeOwnerToken);

      if (
        sensitiveLogoutBarrierCleanupOwnerTokenRef.current === activeOwnerToken
      ) {
        sensitiveLogoutBarrierCleanupOwnerTokenRef.current = null;
      }
    },
    []
  );

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
    authStorage.abortPendingPersistence();
    setBootstrapRecoveryReason(null);
    setUser(null);
    setIsVaultLocked(false);
    setIsPrivacyShielded(false);
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
      invalidateBootstrapRevalidation();

      if (isClearingSessionRef.current) {
        const shouldUpgradeSensitiveState =
          clearSensitiveState && !shouldClearSensitiveStateRef.current;
        const shouldRedirectOpenClients =
          shouldRedirectOpenClientsRef.current ||
          options?.redirectOpenClients === true;
        const previousShouldSkipBarrierVaultTableCleanup =
          shouldSkipBarrierVaultTableCleanupRef.current;

        shouldClearSensitiveStateRef.current =
          shouldClearSensitiveStateRef.current || clearSensitiveState;
        shouldRedirectOpenClientsRef.current = shouldRedirectOpenClients;
        shouldSkipBarrierVaultTableCleanupRef.current =
          shouldSkipBarrierVaultTableCleanupRef.current || clearSensitiveState;

        hasLogoutBarrierRef.current = true;
        setBootstrapRecoveryReason(null);
        setUser(null);
        setIsVaultLocked(false);
        setIsPrivacyShielded(false);
        setIsLoading(false);
        syncOfflineAuthState(false, {
          redirectOpenClients: shouldRedirectOpenClients,
        });

        if (shouldUpgradeSensitiveState) {
          try {
            beginSensitiveLogoutBarrierCleanup();
          } catch (error: unknown) {
            shouldSkipBarrierVaultTableCleanupRef.current =
              previousShouldSkipBarrierVaultTableCleanup;
            console.warn(
              "Failed to create a sensitive logout barrier before cleanup:",
              error
            );
          }
        }

        return;
      }

      const clearSessionCycle = clearSessionCycleRef.current + 1;
      clearSessionCycleRef.current = clearSessionCycle;
      isClearingSessionRef.current = true;
      shouldClearSensitiveStateRef.current = clearSensitiveState;
      shouldResetPrefetchCacheAfterStorageMismatchRef.current = false;
      shouldRedirectOpenClientsRef.current =
        options?.redirectOpenClients === true;
      shouldSkipBarrierVaultTableCleanupRef.current = clearSensitiveState;

      hasLogoutBarrierRef.current = true;
      setBootstrapRecoveryReason(null);
      setUser(null);
      setIsVaultLocked(false);
      setIsPrivacyShielded(false);
      setIsLoading(false);
      syncOfflineAuthState(false, {
        redirectOpenClients: shouldRedirectOpenClientsRef.current,
      });

      if (clearSensitiveState) {
        // Drop prefetch warm-up state on every full session teardown
        // (explicit logout, `session:expired` 401, invalid-payload recovery,
        // cross-tab logout, ...). Otherwise `completedPrefetches` keys from
        // the previous user keep suppressing prefetches for the next user
        // who signs in, weakening the cross-session isolation introduced
        // alongside the prefetch epoch counter in usePrefetch.ts.
        resetPrefetchCache();

        try {
          beginSensitiveLogoutBarrierCleanup();
        } catch (error: unknown) {
          shouldSkipBarrierVaultTableCleanupRef.current = false;
          console.warn(
            "Failed to create a sensitive logout barrier before cleanup:",
            error
          );
        }
      }

      let clearAuthStoragePromise: Promise<void>;

      try {
        clearAuthStoragePromise = authStorage.clear({
          clearOfflineVaultTables:
            !shouldSkipBarrierVaultTableCleanupRef.current,
        });
      } catch (error: unknown) {
        clearAuthStoragePromise = Promise.reject(error);
      }

      const resetAnalyticsStatePromise = waitForLogoutCleanupWithTimeout(
        resetAnalyticsState(),
        "Timed out waiting for analytics reset during logout; continuing with best-effort sensitive cleanup."
      );
      const cleanupSettledPromise = Promise.allSettled([
        clearAuthStoragePromise,
        resetAnalyticsStatePromise,
      ]);
      let destructiveSensitiveLogoutCleanupPromise: Promise<void> | null = null;
      let sensitiveLogoutCleanupPromise: Promise<void> | null = null;
      const sensitiveLogoutCleanupOwnerToken = clearSensitiveState
        ? sensitiveLogoutBarrierCleanupOwnerTokenRef.current
        : null;

      const runDestructiveSensitiveLogoutCleanup = () => {
        if (destructiveSensitiveLogoutCleanupPromise !== null) {
          return destructiveSensitiveLogoutCleanupPromise;
        }

        destructiveSensitiveLogoutCleanupPromise = (async () => {
          const activeSensitiveLogoutCleanupOwnerToken =
            sensitiveLogoutCleanupOwnerToken ??
            sensitiveLogoutBarrierCleanupOwnerTokenRef.current;

          try {
            try {
              await authStorage.waitForSensitiveLogoutCleanupLock(
                activeSensitiveLogoutCleanupOwnerToken
              );
              await authStorage.waitForInFlightVaultTableCleanup();
            } catch (error: unknown) {
              console.warn(
                "Failed while waiting for in-flight vault cleanup during logout:",
                error
              );
            }

            await clearDestructiveSensitiveClientState();
          } finally {
            endSensitiveLogoutBarrierCleanup(
              activeSensitiveLogoutCleanupOwnerToken
            );
          }
        })();

        return destructiveSensitiveLogoutCleanupPromise;
      };

      const runSensitiveLogoutCleanup = () => {
        if (sensitiveLogoutCleanupPromise !== null) {
          return sensitiveLogoutCleanupPromise;
        }

        sensitiveLogoutCleanupPromise =
          runDestructiveSensitiveLogoutCleanup().finally(async () => {
            await clearBrowserPushClientState();
          });

        return sensitiveLogoutCleanupPromise;
      };

      clearAuthenticatedStateDestructivePromiseRef.current =
        cleanupSettledPromise.then(async () => {
          if (!shouldClearSensitiveStateRef.current) {
            return;
          }

          try {
            await runDestructiveSensitiveLogoutCleanup();
          } catch (error: unknown) {
            console.error(
              "Failed to clear sensitive client state during logout:",
              error
            );
          }
        });

      clearAuthenticatedStateCompletionPromiseRef.current =
        clearAuthenticatedStateDestructivePromiseRef.current
          .then(async () => {
            if (!shouldClearSensitiveStateRef.current) {
              return;
            }

            try {
              await waitForLogoutCleanupWithTimeout(
                runSensitiveLogoutCleanup(),
                "Timed out waiting for trailing logout cleanup during logout; continuing with best-effort barrier teardown."
              );
            } catch (error: unknown) {
              console.error(
                "Failed to clear sensitive client state during logout:",
                error
              );
            }
          })
          .finally(() => {
            if (clearSessionCycleRef.current !== clearSessionCycle) {
              return;
            }

            shouldSkipBarrierVaultTableCleanupRef.current = false;
            shouldClearSensitiveStateRef.current = false;
            shouldRedirectOpenClientsRef.current = false;
            isClearingSessionRef.current = false;
            clearAuthenticatedStateDestructivePromiseRef.current =
              Promise.resolve();
            clearAuthenticatedStateCompletionPromiseRef.current =
              Promise.resolve();
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
      const loginVersion = bootstrapRequestVersionRef.current;
      const isCurrentLogin = () =>
        bootstrapRequestVersionRef.current === loginVersion;

      try {
        await authStorage.abortPendingVaultCleanup();
      } catch {
        setIsLoading(false);
        setBootstrapRecoveryReason("network");
        return;
      }

      if (!isCurrentLogin()) {
        return;
      }

      try {
        await clearAuthenticatedStateDestructivePromiseRef.current;
      } catch (error: unknown) {
        console.warn(
          "Failed while waiting for destructive logout cleanup before login; continuing with best-effort session handoff:",
          error
        );
      }

      if (!isCurrentLogin()) {
        return;
      }

      try {
        await waitForLogoutCleanupWithTimeout(
          clearAuthenticatedStateCompletionPromiseRef.current,
          "Timed out waiting for trailing logout cleanup before login; continuing after destructive cleanup.",
          AUTH_LOGIN_AFTER_LOGOUT_CLEANUP_WAIT_TIMEOUT_MS
        );
      } catch (error: unknown) {
        console.warn(
          "Failed while waiting for trailing logout cleanup before login; continuing after destructive cleanup:",
          error
        );
      }

      if (!isCurrentLogin()) {
        return;
      }

      let persistenceResult: AuthUserPersistenceResult;

      try {
        persistenceResult = await persistAuthenticatedUser(sanitizedUser, {
          shouldCommit: isCurrentLogin,
        });
      } catch (error) {
        if (!isCurrentLogin()) {
          return;
        }

        if (!(error instanceof AuthUserPersistenceError)) {
          throw error;
        }

        console.warn(
          "Secure auth persistence failed after authentication; holding routes behind recovery UI."
        );
        setUser(null);
        setIsLoading(false);
        setBootstrapRecoveryReason("network");
        syncOfflineAuthState(false);
        return;
      }

      if (persistenceResult.status === "superseded" || !isCurrentLogin()) {
        return;
      }

      hasLogoutBarrierRef.current = false;
      shouldSkipBarrierVaultTableCleanupRef.current = false;
      setBootstrapRecoveryReason(null);
      setUser(sanitizedUser);
      setIsVaultLocked(false);
      setIsPrivacyShielded(false);
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
    await clearAuthenticatedStateCompletionPromiseRef.current;
  }, [clearAuthenticatedState]);

  const handleNativeLogout = useCallback(async () => {
    clearAuthenticatedState(true, { redirectOpenClients: false });
    await clearAuthenticatedStateCompletionPromiseRef.current;
  }, [clearAuthenticatedState]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleNativeLogoutEvent = () => {
      void handleNativeLogout();
    };

    window.addEventListener(
      NATIVE_AUTH_LOGOUT_EVENT_NAME,
      handleNativeLogoutEvent
    );

    return () => {
      window.removeEventListener(
        NATIVE_AUTH_LOGOUT_EVENT_NAME,
        handleNativeLogoutEvent
      );
    };
  }, [handleNativeLogout]);

  const lock = useCallback(() => {
    authStorage.lockVault();
    invalidateBootstrapRevalidation();
    setBootstrapRecoveryReason(null);
    setUser(null);
    setIsPrivacyShielded(false);
    setIsVaultLocked(true);
    setIsLoading(false);
    // Vault lock is a recoverable local state, so keep offline session access enabled.
    syncOfflineAuthState(true);
  }, [invalidateBootstrapRevalidation, syncOfflineAuthState]);

  const reconcileVaultUnlockLogoutBarrier = useCallback(() => {
    if (!hasLogoutBarrierRef.current && !syncBarrierStateFromStorage()) {
      return false;
    }

    reconcileActiveBarrierState();
    return true;
  }, [reconcileActiveBarrierState, syncBarrierStateFromStorage]);

  const preserveLockedVault = useCallback(() => {
    if (reconcileVaultUnlockLogoutBarrier()) {
      return;
    }

    setBootstrapRecoveryReason(null);
    setUser(null);
    setIsPrivacyShielded(false);
    setIsVaultLocked(true);
    setIsLoading(false);
    syncOfflineAuthState(true);
  }, [reconcileVaultUnlockLogoutBarrier, syncOfflineAuthState]);

  const applyVaultUnlockResult = useCallback(
    (result: AuthVaultUnlockResult): boolean => {
      if (reconcileVaultUnlockLogoutBarrier()) {
        return false;
      }

      if (result.status === "empty") {
        clearAuthenticatedState(true);
        return false;
      }

      if (result.status === "unavailable") {
        preserveLockedVault();
        return false;
      }

      hasLogoutBarrierRef.current = false;
      shouldSkipBarrierVaultTableCleanupRef.current = false;
      setBootstrapRecoveryReason(null);
      invalidateBootstrapRevalidation();
      setUser(result.user);
      setIsVaultLocked(false);
      setIsPrivacyShielded(false);
      setIsLoading(false);
      syncOfflineAuthState(true);
      return true;
    },
    [
      clearAuthenticatedState,
      invalidateBootstrapRevalidation,
      preserveLockedVault,
      reconcileVaultUnlockLogoutBarrier,
      syncOfflineAuthState,
    ]
  );

  const unlock = useCallback(async (): Promise<boolean> => {
    invalidateBootstrapRevalidation();
    const unlockVersion = bootstrapRequestVersionRef.current;
    setIsLoading(true);

    try {
      const result = await authStorage.unlockVault();

      if (bootstrapRequestVersionRef.current !== unlockVersion) {
        return false;
      }

      return applyVaultUnlockResult(result);
    } catch (error) {
      if (bootstrapRequestVersionRef.current !== unlockVersion) {
        return false;
      }

      console.error("Failed to unlock offline vault:", error);
      preserveLockedVault();
      return false;
    }
  }, [
    applyVaultUnlockResult,
    invalidateBootstrapRevalidation,
    preserveLockedVault,
  ]);

  const showPrivacyShield = useCallback(() => {
    if (isVaultLocked) {
      return;
    }

    setIsPrivacyShielded(true);
  }, [isVaultLocked]);

  const hidePrivacyShield = useCallback(() => {
    setIsPrivacyShielded(false);
  }, []);

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

    if (hasLogoutBarrierRef.current || authStorage.hasLogoutBarrier()) {
      setBootstrapRecoveryReason(null);
      setIsLoading(false);
      return;
    }

    hasAutomaticallyRetriedBootstrapRef.current = false;
    setBootstrapRecoveryReason(null);
    setIsLoading(true);
    setBootstrapRetryKey((currentValue) => currentValue + 1);
  }, [authTransport.kind]);

  const revalidateSessionAfterStorageMismatch = useCallback(() => {
    const hasLogoutBarrier =
      hasLogoutBarrierRef.current || syncBarrierStateFromStorage();

    if (hasLogoutBarrier) {
      reconcileActiveBarrierState();
      return;
    }

    const shouldRevalidate =
      authTransport.kind === "native-bridge" ||
      (isOnline() &&
        shouldBootstrapBrowserSessionWithoutStoredUser(
          authTransport.kind,
          hasLogoutBarrier
        ));

    if (shouldRevalidate) {
      shouldResetPrefetchCacheAfterStorageMismatchRef.current = true;
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

    shouldResetPrefetchCacheAfterStorageMismatchRef.current = false;
    resetPrefetchCache();
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
    reconcileActiveBarrierState,
    syncBarrierStateFromStorage,
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
      clearSensitiveStateOnInvalidSession: boolean,
      restoredUser: User | null = null
    ) => {
      const clearBootstrapToLoggedOutState = () => {
        if (shouldResetPrefetchCacheAfterStorageMismatchRef.current) {
          shouldResetPrefetchCacheAfterStorageMismatchRef.current = false;
          resetPrefetchCache();
        }
        hasLogoutBarrierRef.current = false;
        shouldSkipBarrierVaultTableCleanupRef.current = false;
        setBootstrapRecoveryReason(null);
        setUser(null);
        setIsVaultLocked(false);
        setIsLoading(false);
        syncOfflineAuthState(false);
      };

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
        authStorage.abortPendingPersistence();
        if (
          shouldTreatBootstrapFailureWithoutStoredUserAsLoggedOut(
            clearSensitiveStateOnInvalidSession,
            authTransport.kind
          )
        ) {
          invalidateBootstrapRevalidation();
          clearBootstrapToLoggedOutState();
          return;
        }

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
          if (
            !isActive ||
            bootstrapRequestVersionRef.current !== requestVersion ||
            hasLogoutBarrierRef.current
          ) {
            return;
          }

          if (
            authTransport.kind === "native-bridge" &&
            restoredUser !== null &&
            currentUser.id !== restoredUser.id
          ) {
            authStorage.requireUserRevalidation();
            setUser(null);
            syncOfflineAuthState(false);
          }

          let persistenceResult: AuthUserPersistenceResult;

          try {
            persistenceResult = await persistAuthenticatedUser(currentUser, {
              shouldCommit: () =>
                isActive &&
                bootstrapRequestVersionRef.current === requestVersion &&
                !hasLogoutBarrierRef.current,
            });
          } catch (error: unknown) {
            throw createConfirmedBootstrapSessionError(error);
          }

          if (persistenceResult.status === "superseded") {
            return;
          }

          if (timeoutId !== null) {
            globalThis.clearTimeout(timeoutId);
          }

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
          shouldResetPrefetchCacheAfterStorageMismatchRef.current = false;
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
              clearBootstrapToLoggedOutState();
              return;
            }

            clearAuthenticatedState(clearSensitiveStateOnInvalidSession, {
              redirectOpenClients: false,
            });
            return;
          }

          if (isOfflineBootstrapError(error)) {
            setIsLoading(false);
            setBootstrapRecoveryReason(
              authTransport.kind === "native-bridge" &&
                !clearSensitiveStateOnInvalidSession
                ? "network"
                : null
            );
            return;
          }

          if (
            !isConfirmedBootstrapSessionError(error) &&
            shouldTreatBootstrapFailureWithoutStoredUserAsLoggedOut(
              clearSensitiveStateOnInvalidSession,
              authTransport.kind
            )
          ) {
            clearBootstrapToLoggedOutState();
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
      const storedUserResult =
        authTransport.kind === "native-bridge" && hadStoredUser
          ? await readStoredUserWithinBootstrapTimeout()
          : {
              status: "completed" as const,
              user: await authStorage.getUser(),
            };

      if (!isActive || bootstrapRequestVersionRef.current !== requestVersion) {
        return;
      }

      if (hasLogoutBarrierRef.current || syncBarrierStateFromStorage()) {
        reconcileActiveBarrierState();
        return;
      }

      if (storedUserResult.status === "timed-out") {
        setUser(null);
        setIsVaultLocked(false);
        setIsLoading(false);
        setBootstrapRecoveryReason("timeout");
        syncOfflineAuthState(false);
        return;
      }

      const storedUser = storedUserResult.user;

      if (!storedUser) {
        const shouldBootstrapWithoutStoredUser =
          shouldBootstrapSessionWithoutStoredUser(
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

          startBootstrapRevalidation(true);
          return;
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

      const networkAvailable = await isNetworkAvailableWithinBootstrapTimeout(
        () => authTransport.isNetworkAvailable()
      );

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

      startBootstrapRevalidation(true, storedUser);
    };

    void restoreAndRevalidate().catch((error: unknown) => {
      if (!isActive || bootstrapRequestVersionRef.current !== requestVersion) {
        return;
      }

      if (isRecoverableLazyModuleError(error)) {
        console.warn(
          "Failed to restore persisted auth state because a lazy auth chunk could not be loaded; keeping the route behind recovery UI.",
          error
        );
        setUser(null);
        setIsVaultLocked(false);
        setIsLoading(false);
        setBootstrapRecoveryReason("network");
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
    const restoreCrossTabAuthState = () => {
      // Stop any startup restore/revalidation that may have observed this
      // storage write before the cross-tab storage handler adopts it.
      invalidateBootstrapRevalidation();
      const restoreVersion = bootstrapRequestVersionRef.current;

      void (async () => {
        try {
          const nextUser = await authStorage.getUser();

          if (bootstrapRequestVersionRef.current !== restoreVersion) {
            return;
          }

          // Re-check the in-memory barrier after the async decrypt because
          // an inflight setUser() from bootstrap may have already cleared the
          // localStorage barrier (via clearLogoutBarrier()) before we got
          // here.
          if (hasLogoutBarrierRef.current || syncBarrierStateFromStorage()) {
            reconcileActiveBarrierState();
            return;
          }

          if (authStorage.getUserRevalidationOwnerToken() !== null) {
            return;
          }

          if (!nextUser) {
            revalidateSessionAfterStorageMismatch();
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
          if (bootstrapRequestVersionRef.current !== restoreVersion) {
            return;
          }

          console.error("Failed to parse cross-tab auth state:", error);
          revalidateSessionAfterStorageMismatch();
        }
      })();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.storageArea !== localStorage) {
        return;
      }

      if (
        event.key === "auth_logout_barrier" ||
        event.key === AUTH_USER_REVALIDATION_REQUIRED_KEY ||
        event.key === AUTH_VAULT_LOCK_KEY ||
        event.key === "auth_user" ||
        event.key === AUTH_VAULT_STORAGE_KEY
      ) {
        invalidateBootstrapRevalidation();
      }

      if (event.key === "auth_logout_barrier" && event.newValue !== null) {
        clearAuthenticatedState(true);
        return;
      }

      if (event.key === AUTH_USER_REVALIDATION_REQUIRED_KEY) {
        if (event.newValue === null) {
          restoreCrossTabAuthState();
          return;
        }

        if (hasLogoutBarrierRef.current || syncBarrierStateFromStorage()) {
          reconcileActiveBarrierState();
          return;
        }

        invalidateBootstrapRevalidation();
        setUser(null);
        setIsVaultLocked(false);
        setIsLoading(false);
        setBootstrapRecoveryReason("network");
        syncOfflineAuthState(false);
        return;
      }

      if (event.key === AUTH_VAULT_LOCK_KEY) {
        if (event.newValue !== null) {
          invalidateBootstrapRevalidation();
          setBootstrapRecoveryReason(null);
          setUser(null);
          setIsPrivacyShielded(false);
          setIsVaultLocked(true);
          setIsLoading(false);
          syncOfflineAuthState(true);
          return;
        }

        const unlockVersion = bootstrapRequestVersionRef.current;

        void (async () => {
          try {
            const result = await authStorage.unlockVault();

            if (bootstrapRequestVersionRef.current !== unlockVersion) {
              return;
            }

            applyVaultUnlockResult(result);
          } catch (error) {
            if (bootstrapRequestVersionRef.current !== unlockVersion) {
              return;
            }

            console.error("Failed to unlock cross-tab auth vault:", error);
            preserveLockedVault();
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
        revalidateSessionAfterStorageMismatch();
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

      restoreCrossTabAuthState();
    };

    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("storage", handleStorage);
    };
  }, [
    applyVaultUnlockResult,
    clearAuthenticatedState,
    invalidateBootstrapRevalidation,
    preserveLockedVault,
    revalidateSessionAfterStorageMismatch,
    reconcileActiveBarrierState,
    syncBarrierStateFromStorage,
    syncOfflineAuthState,
  ]);

  useEffect(() => {
    const reconcileRestoredPageState = (event: PageTransitionEvent) => {
      if (!event.persisted) {
        return;
      }

      invalidateBootstrapRevalidation();
      const restoreVersion = bootstrapRequestVersionRef.current;

      void (async () => {
        if (authStorage.hasVaultLock?.()) {
          setBootstrapRecoveryReason(null);
          setUser(null);
          setIsPrivacyShielded(false);
          setIsVaultLocked(true);
          setIsLoading(false);
          syncOfflineAuthState(true);
          return;
        }

        const storedUser = await authStorage.getUser();

        if (bootstrapRequestVersionRef.current !== restoreVersion) {
          return;
        }

        // Re-check the in-memory barrier after the async decrypt.
        if (hasLogoutBarrierRef.current || syncBarrierStateFromStorage()) {
          reconcileActiveBarrierState();
          return;
        }

        if (!storedUser) {
          if (
            authTransport.kind === "native-bridge" &&
            !hasLogoutBarrierRef.current
          ) {
            hasAutomaticallyRetriedBootstrapRef.current = false;
            invalidateBootstrapRevalidation();
            setBootstrapRecoveryReason(null);
            setIsLoading(true);
            setBootstrapRetryKey((currentValue) => currentValue + 1);
            return;
          }

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
    authTransport.kind,
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
      isPrivacyShielded,
      sensitiveUiState: getSensitiveUiState({
        isPrivacyShieldVisible: isPrivacyShielded,
        isVaultLocked,
      }),
      bootstrapRecoveryReason,
      login,
      logout,
      lock,
      unlock,
      showPrivacyShield,
      hidePrivacyShield,
      retryBootstrap,
      hasPermission,
      hasOrganizationalAccess,
      isVaultLocked,
    }),
    [
      user,
      isLoading,
      isPrivacyShielded,
      bootstrapRecoveryReason,
      login,
      logout,
      lock,
      unlock,
      showPrivacyShield,
      hidePrivacyShield,
      retryBootstrap,
      hasPermission,
      hasOrganizationalAccess,
      isVaultLocked,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
