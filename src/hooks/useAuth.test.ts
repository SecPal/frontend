// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { afterEach, describe, it, expect, beforeEach, vi } from "vitest";
import Dexie from "dexie";
import {
  renderHook,
  act,
  waitFor as waitForTestingLibrary,
} from "@testing-library/react";
import {
  AuthProvider,
  BOOTSTRAP_REVALIDATION_TIMEOUT_MS,
} from "../contexts/AuthContext";
import { ApiBaseUrlConfigurationError } from "../config";
import { useAuth } from "./useAuth";
import { AuthApiError } from "../services/authApi";
import { sanitizePersistedAuthUser } from "../services/authState";
import { AuthUserPersistenceError, authStorage } from "../services/storage";
import { sessionEvents } from "../services/sessionEvents";
import {
  clearBrowserPushClientState,
  clearSensitiveClientState,
} from "../lib/clientStateCleanup";
import { createRecoverableLazyModuleError } from "../lib/lazyModuleErrors";
import * as prefetch from "./usePrefetch";
import {
  AUTH_USER_REVALIDATION_REQUIRED_KEY,
  AUTH_VAULT_LOCK_KEY,
  AUTH_VAULT_STORAGE_KEY,
  clearRecentAuthVaultKeyMaterials,
  clearOfflineVaultSession,
  readPersistedAuthUserFromVault,
} from "../lib/offlineVault";
import { db } from "../lib/db";
import { getActiveOfflineVaultSession } from "../lib/offlineVaultRuntime";
import { syncOfflineSessionAccess } from "../lib/serviceWorkerSession";
import { installSerializedWebLocks } from "../testUtils/serializedWebLocks";

const {
  mockGetCurrentUser,
  mockAnalyticsResetForLogout,
  mockAnalyticsResumeAuthenticatedSession,
  mockFetchCsrfToken,
  mockClearSensitiveClientState,
  mockClearBrowserPushClientState,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockAnalyticsResetForLogout: vi.fn(),
  mockAnalyticsResumeAuthenticatedSession: vi.fn(),
  mockFetchCsrfToken: vi.fn(),
  mockClearSensitiveClientState: vi.fn().mockResolvedValue(undefined),
  mockClearBrowserPushClientState: vi.fn().mockResolvedValue(undefined),
}));

const AUTH_BOOTSTRAP_TIMEOUT_MS = 20_000;
let restoreSerializedWebLocks: (() => void) | null = null;

vi.mock("../services/authApi", async () => {
  const actual = await vi.importActual("../services/authApi");
  return {
    ...actual,
    getCurrentUser: mockGetCurrentUser,
  };
});

vi.mock("../services/csrf", async () => {
  const actual = await vi.importActual("../services/csrf");
  return {
    ...actual,
    fetchCsrfToken: mockFetchCsrfToken,
  };
});

vi.mock("../lib/clientStateCleanup", () => ({
  clearSensitiveClientState: mockClearSensitiveClientState,
  clearDestructiveSensitiveClientState: mockClearSensitiveClientState,
  clearBrowserPushClientState: mockClearBrowserPushClientState,
  clearTrailingSensitiveClientState: mockClearBrowserPushClientState,
}));

vi.mock("../lib/analytics", () => ({
  analytics: {
    resetForLogout: mockAnalyticsResetForLogout,
    resumeAuthenticatedSession: mockAnalyticsResumeAuthenticatedSession,
  },
}));

vi.mock("../lib/serviceWorkerSession", () => ({
  syncOfflineSessionAccess: vi.fn().mockResolvedValue(undefined),
}));

function setCsrfTokenCookie(value: string): void {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
  document.cookie = `XSRF-TOKEN=${encodeURIComponent(value)};path=/`;
}

function clearCsrfTokenCookie(): void {
  document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
}

function installNativeAuthBridge(
  overrides: Partial<{
    getCurrentUser: () => Promise<unknown>;
    logout: () => Promise<void>;
  }> = {}
) {
  const logoutSpy = overrides.logout ?? vi.fn().mockResolvedValue(undefined);
  const bridge = {
    login: vi.fn(),
    logout: logoutSpy,
    getCurrentUser: vi.fn().mockResolvedValue({
      id: "42",
      name: "Native User",
      email: "native@secpal.dev",
      emailVerified: true,
    }),
    isNetworkAvailable: vi.fn().mockResolvedValue(true),
    ...overrides,
  };

  vi.stubGlobal("Capacitor", { isNativePlatform: () => true });
  vi.stubGlobal("SecPalNativeAuthBridge", bridge);
  return { ...bridge, logoutSpy };
}

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function dispatchLocalStorageEvent(
  key: string,
  newValue: string | null,
  oldValue: string | null = null
): void {
  const event = new Event("storage");
  Object.defineProperties(event, {
    key: { value: key },
    oldValue: { value: oldValue },
    newValue: { value: newValue },
    storageArea: { value: localStorage },
  } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
  window.dispatchEvent(event);
}

async function persistAuthUser(user: Record<string, unknown>): Promise<string> {
  const persistedUser = sanitizePersistedAuthUser(user);

  if (!persistedUser) {
    throw new Error("Failed to seed persisted auth user for test");
  }

  await authStorage.setUser(persistedUser);
  mockGetCurrentUser.mockResolvedValue(persistedUser);
  const storedUser = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

  expect(storedUser).not.toBeNull();

  return storedUser as string;
}

function expectNoStoredAuthState(): void {
  expect(localStorage.getItem("auth_user")).toBeNull();
  expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
}

function requireActiveOfflineVaultSession() {
  const session = getActiveOfflineVaultSession();

  if (!session) {
    throw new Error("Expected an active offline vault session");
  }

  return session;
}

async function waitForAuthState(
  assertion: Parameters<typeof waitForTestingLibrary>[0],
  timeout = AUTH_BOOTSTRAP_TIMEOUT_MS
) {
  await waitForTestingLibrary(assertion, {
    timeout,
  });
}

const waitFor = waitForAuthState;

async function waitForSensitiveClientCleanup(callCount: number = 1) {
  await waitFor(() => {
    expect(clearSensitiveClientState).toHaveBeenCalledTimes(callCount);
  });
}

async function expectEncryptedStoredUser(
  expectedUser: Record<string, unknown>
): Promise<void> {
  const storedUser = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

  expect(storedUser).not.toBeNull();

  const parsedStoredUser = JSON.parse(storedUser as string) as unknown;

  expect(parsedStoredUser).toEqual(expect.any(Object));
  expect(parsedStoredUser).not.toBeNull();
  expect(parsedStoredUser).not.toEqual(expect.objectContaining(expectedUser));
  await expect(authStorage.getUser()).resolves.toEqual(expectedUser);
}

describe("useAuth", () => {
  beforeEach(() => {
    restoreSerializedWebLocks = installSerializedWebLocks();
    localStorage.clear();
    sessionStorage.clear();
    clearOfflineVaultSession();
    window.history.replaceState({}, "", "/login");
    setCsrfTokenCookie("test-csrf-token");
    vi.clearAllMocks();
    mockGetCurrentUser.mockReset();
    vi.mocked(syncOfflineSessionAccess).mockReset();
    vi.mocked(clearSensitiveClientState).mockReset();
    vi.mocked(clearBrowserPushClientState).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    sessionEvents.reset();
    mockGetCurrentUser.mockResolvedValue({
      id: 1,
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
    });
    mockFetchCsrfToken.mockReset();
    mockFetchCsrfToken.mockImplementation(async () => {
      setCsrfTokenCookie("refreshed-csrf-token");
    });
    mockAnalyticsResetForLogout.mockReset();
    mockAnalyticsResetForLogout.mockResolvedValue(undefined);
    mockAnalyticsResumeAuthenticatedSession.mockReset();
    vi.mocked(clearSensitiveClientState).mockResolvedValue(undefined);
    vi.mocked(clearBrowserPushClientState).mockResolvedValue(undefined);
    vi.mocked(syncOfflineSessionAccess).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    clearOfflineVaultSession();
    restoreSerializedWebLocks?.();
    restoreSerializedWebLocks = null;
  });

  it("throws error when used outside AuthProvider", () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within an AuthProvider");
  });

  it("initializes with no user on onboarding/complete when localStorage is empty", () => {
    window.history.replaceState({}, "", "/onboarding/complete");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it("initializes with no user on /source when localStorage is empty", () => {
    window.history.replaceState({}, "", "/source");
    clearCsrfTokenCookie();

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it("rehydrates browser-session auth on /source when csrf exists and localStorage is empty", async () => {
    window.history.replaceState({}, "", "/source");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user).toEqual({
      id: "1",
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
      emailVerified: false,
    });
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("bootstraps a protected browser-session route even when local auth storage is empty", async () => {
    window.history.replaceState({}, "", "/");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user).toEqual({
      id: "1",
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
      emailVerified: false,
    });
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("still bootstraps a protected browser-session route when the readable csrf cookie is missing", async () => {
    window.history.replaceState({}, "", "/");
    clearCsrfTokenCookie();

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  it.each(["/login", "/"])(
    "rehydrates and securely persists a snapshotless native session on %s",
    async (pathname) => {
      clearCsrfTokenCookie();
      window.history.replaceState({}, "", pathname);
      const native = installNativeAuthBridge();

      const { result, unmount } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(native.getCurrentUser).toHaveBeenCalledTimes(1);
      expect(result.current.user).toEqual({
        id: "42",
        name: "Native User",
        email: "native@secpal.dev",
        emailVerified: true,
      });
      expect(result.current.bootstrapRecoveryReason).toBeNull();
      await expect(authStorage.getUser()).resolves.toEqual(result.current.user);

      if (pathname === "/login") {
        unmount();
        clearOfflineVaultSession();
        const restarted = renderHook(() => useAuth(), {
          wrapper: AuthProvider,
        });
        await waitFor(() => {
          expect(restarted.result.current.isAuthenticated).toBe(true);
        });
      }
    }
  );

  it("does not rehydrate a native session through an explicit logout barrier", async () => {
    const native = installNativeAuthBridge();
    localStorage.setItem("auth_logout_barrier", "1");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(native.getCurrentUser).not.toHaveBeenCalled();
  });

  it.each(["NO_STORED_TOKEN", "HTTP_401"])(
    "treats native %s as logged out without destructive cleanup",
    async (code) => {
      const native = installNativeAuthBridge({
        getCurrentUser: vi
          .fn()
          .mockRejectedValue(Object.assign(new Error(code), { code })),
      });
      const clearSpy = vi.spyOn(authStorage, "clear");

      try {
        const { result } = renderHook(() => useAuth(), {
          wrapper: AuthProvider,
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.user).toBeNull();
        expect(result.current.bootstrapRecoveryReason).toBeNull();
        expect(native.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(clearSpy).not.toHaveBeenCalled();
        expect(native.logoutSpy).not.toHaveBeenCalled();
      } finally {
        clearSpy.mockRestore();
      }
    }
  );

  it.each([
    { code: "NETWORK_ERROR", expectedCalls: 2, expectedWarnings: 1 },
    { code: "NETWORK_OFFLINE", expectedCalls: 1, expectedWarnings: 0 },
  ])(
    "keeps native $code failures in non-destructive recovery",
    async ({ code, expectedCalls, expectedWarnings }) => {
      const getCurrentUser = vi.fn().mockRejectedValue(
        Object.assign(new Error("Network unavailable."), {
          code,
        })
      );
      const native = installNativeAuthBridge({ getCurrentUser });
      const clearSpy = vi.spyOn(authStorage, "clear");
      const consoleWarnSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => undefined);

      try {
        const { result } = renderHook(() => useAuth(), {
          wrapper: AuthProvider,
        });

        await waitFor(() => {
          expect(result.current.bootstrapRecoveryReason).toBe("network");
        });
        expect(getCurrentUser).toHaveBeenCalledTimes(expectedCalls);
        expect(clearSpy).not.toHaveBeenCalled();
        expect(native.logoutSpy).not.toHaveBeenCalled();
        expect(consoleWarnSpy).toHaveBeenCalledTimes(expectedWarnings);
      } finally {
        consoleWarnSpy.mockRestore();
        clearSpy.mockRestore();
      }
    }
  );

  it("keeps a native session in retryable recovery when secure persistence fails", async () => {
    const native = installNativeAuthBridge();
    const originalSetUser = authStorage.setUser.bind(authStorage);
    const setUserSpy = vi
      .spyOn(authStorage, "setUser")
      .mockRejectedValueOnce(new AuthUserPersistenceError())
      .mockRejectedValueOnce(new AuthUserPersistenceError())
      .mockImplementation(originalSetUser);
    const clearSpy = vi.spyOn(authStorage, "clear");
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.bootstrapRecoveryReason).toBe("network");
      });
      expect(result.current.isAuthenticated).toBe(false);
      expect(clearSpy).not.toHaveBeenCalled();
      expect(native.logoutSpy).not.toHaveBeenCalled();

      act(() => result.current.retryBootstrap());
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });
      expect(setUserSpy).toHaveBeenCalledTimes(3);
    } finally {
      consoleWarnSpy.mockRestore();
      clearSpy.mockRestore();
      setUserSpy.mockRestore();
    }
  });

  it("bounds native vault restoration before exposing timeout recovery", async () => {
    const native = installNativeAuthBridge();
    const getUserSpy = vi
      .spyOn(authStorage, "getUser")
      .mockImplementationOnce(() => new Promise(() => undefined));
    const hasStoredUserSpy = vi
      .spyOn(authStorage, "hasStoredUser")
      .mockReturnValue(true);
    vi.useFakeTimers();

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.bootstrapRecoveryReason).toBe("timeout");
      expect(native.getCurrentUser).not.toHaveBeenCalled();
    } finally {
      hasStoredUserSpy.mockRestore();
      getUserSpy.mockRestore();
    }
  });

  it("ignores a stale native vault restoration timeout after logout", async () => {
    installNativeAuthBridge();
    const getUserSpy = vi
      .spyOn(authStorage, "getUser")
      .mockImplementationOnce(() => new Promise(() => undefined));
    const hasStoredUserSpy = vi
      .spyOn(authStorage, "hasStoredUser")
      .mockReturnValue(true);
    vi.useFakeTimers();

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        void result.current.logout();
      });

      expect(result.current.bootstrapRecoveryReason).toBeNull();
      expect(result.current.isLoading).toBe(false);
      const offlineSyncCallCountAfterLogout = vi.mocked(
        syncOfflineSessionAccess
      ).mock.calls.length;

      await act(async () => {
        await vi.advanceTimersByTimeAsync(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
      });

      expect(result.current.bootstrapRecoveryReason).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(syncOfflineSessionAccess).toHaveBeenCalledTimes(
        offlineSyncCallCountAfterLogout
      );
    } finally {
      hasStoredUserSpy.mockRestore();
      getUserSpy.mockRestore();
    }
  });

  it("treats protected-route bootstrap failures without a local snapshot or readable csrf cookie as logged out", async () => {
    window.history.replaceState({}, "", "/");
    clearCsrfTokenCookie();
    mockGetCurrentUser.mockRejectedValueOnce(
      new AuthApiError(
        "Current user fetch failed: Failed to fetch",
        undefined,
        undefined,
        "NETWORK_ERROR"
      )
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.bootstrapRecoveryReason).toBeNull();
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("treats protected-route bootstrap timeouts without a local snapshot or readable csrf cookie as logged out", async () => {
    window.history.replaceState({}, "", "/");
    clearCsrfTokenCookie();
    mockGetCurrentUser.mockImplementation(
      () =>
        new Promise(() => undefined) as ReturnType<typeof mockGetCurrentUser>
    );
    vi.useFakeTimers();

    const { result, unmount } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    try {
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
        }
      });

      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
        await Promise.resolve();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.bootstrapRecoveryReason).toBeNull();
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    } finally {
      unmount();
    }
  });

  it("ignores a late bootstrap success after timing out to logged out without a local snapshot or readable csrf cookie", async () => {
    window.history.replaceState({}, "", "/");
    clearCsrfTokenCookie();
    const deferred = createDeferredPromise<{
      id: number;
      name: string;
      email: string;
    }>();
    mockGetCurrentUser.mockImplementation(() => deferred.promise);
    vi.useFakeTimers();

    const { result, unmount } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    try {
      await act(async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
        }
      });

      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
        await Promise.resolve();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.bootstrapRecoveryReason).toBeNull();

      await act(async () => {
        deferred.resolve({
          id: 1,
          name: "Late Bootstrap User",
          email: "late-bootstrap@secpal.dev",
        });
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
        }
      });

      expect(mockFetchCsrfToken).not.toHaveBeenCalled();
      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.bootstrapRecoveryReason).toBeNull();
    } finally {
      unmount();
    }
  });

  it("keeps confirmed browser sessions behind recovery UI when csrf refresh fails after /v1/me succeeds", async () => {
    window.history.replaceState({}, "", "/");
    clearCsrfTokenCookie();
    mockGetCurrentUser.mockResolvedValue({
      id: 1,
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
    });
    mockFetchCsrfToken.mockRejectedValue(
      new AuthApiError(
        "CSRF refresh failed: Network down",
        undefined,
        undefined,
        "NETWORK_ERROR"
      )
    );
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.bootstrapRecoveryReason).toBe("network");
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(2);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0]?.[0]).toBe(
      "Auth bootstrap revalidation failed; holding protected routes behind recovery UI."
    );
  });

  it("does not run sensitive logout cleanup when bootstrap revalidation finds no browser-session user", async () => {
    window.history.replaceState({}, "", "/");
    mockGetCurrentUser.mockRejectedValue(
      Object.assign(new Error("Unauthenticated."), {
        code: "HTTP_401",
      })
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
    expect(syncOfflineSessionAccess).toHaveBeenCalledWith(false);
    expect(
      vi
        .mocked(syncOfflineSessionAccess)
        .mock.calls.some(
          ([isAuthenticated, options]) =>
            isAuthenticated === false && options?.redirectOpenClients === true
        )
    ).toBe(false);
  });

  it("bootstraps browser-session auth on the login route with a trailing slash when no local auth snapshot exists", async () => {
    window.history.replaceState({}, "", "/login/");
    mockGetCurrentUser.mockResolvedValueOnce({
      id: 1,
      name: "Recovered Login User",
      email: "recovered-login@secpal.dev",
      emailVerified: true,
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user).toEqual({
      id: "1",
      name: "Recovered Login User",
      email: "recovered-login@secpal.dev",
      emailVerified: true,
    });
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("skips the login-route browser-session probe when no local snapshot, csrf cookie, or redirect hint exists", async () => {
    document.cookie = `XSRF-TOKEN=;expires=${new Date(0).toUTCString()};path=/`;
    window.history.replaceState({}, "", "/login");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it("revalidates stale login-route browser-session auth even without a csrf cookie", async () => {
    window.history.replaceState({}, "", "/login");
    clearCsrfTokenCookie();
    const hasStoredUserSpy = vi
      .spyOn(authStorage, "hasStoredUser")
      .mockReturnValue(true);
    const getUserSpy = vi.spyOn(authStorage, "getUser").mockResolvedValue(null);
    mockGetCurrentUser.mockRejectedValueOnce(
      Object.assign(new Error("Unauthenticated."), {
        code: "HTTP_401",
      })
    );

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
      await waitForSensitiveClientCleanup();
    } finally {
      hasStoredUserSpy.mockRestore();
      getUserSpy.mockRestore();
    }
  });

  it("adopts a cross-tab login after an unauthenticated login-route bootstrap probe with no local auth snapshot", async () => {
    window.history.replaceState({}, "", "/login");
    mockGetCurrentUser.mockRejectedValueOnce(
      Object.assign(new Error("Unauthenticated."), {
        code: "HTTP_401",
      })
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(false);

    const crossTabUser = {
      id: "1",
      name: "Recovered Login User",
      email: "recovered-login@secpal.dev",
      emailVerified: true,
    };

    await authStorage.setUser(crossTabUser);

    const storedVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

    expect(storedVaultState).not.toBeNull();

    await act(async () => {
      const storageEvent = new Event("storage");

      Object.defineProperties(storageEvent, {
        key: { value: AUTH_VAULT_STORAGE_KEY },
        oldValue: { value: null },
        newValue: { value: storedVaultState },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);

      window.dispatchEvent(storageEvent);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user).toEqual(crossTabUser);
  });

  it("revalidates a stored user before completing bootstrap", async () => {
    const mockUser = {
      id: 1,
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const storedUser = sanitizePersistedAuthUser(mockUser);
    const revalidatedUser = {
      ...mockUser,
      permissions: ["employees.read"],
    };
    const expectedRevalidatedUser = { ...revalidatedUser, id: "1" };
    const deferred = createDeferredPromise<typeof revalidatedUser>();

    expect(storedUser).not.toBeNull();
    await authStorage.setUser(storedUser!);
    mockGetCurrentUser.mockReturnValueOnce(deferred.promise);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(true);

    // Encrypted storage is read asynchronously; wait for getUser() to decrypt
    // and set the cached user before bootstrap revalidation completes.
    await waitFor(() => {
      expect(result.current.user).toEqual({ ...mockUser, id: "1" });
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(true);

    deferred.resolve(revalidatedUser);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(expectedRevalidatedUser);
    await expectEncryptedStoredUser(expectedRevalidatedUser);
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("does not restore auth state when bootstrap revalidation resolves after logout", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
    };
    const revalidatedUser = {
      ...mockUser,
      permissions: ["employees.read"],
    };
    const deferred = createDeferredPromise<typeof revalidatedUser>();

    await authStorage.setUser(mockUser);
    mockGetCurrentUser.mockReturnValueOnce(deferred.promise);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    // Encrypted storage is read asynchronously; wait for getUser() to decrypt
    // and set the cached user before proceeding.
    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
    expect(result.current.isLoading).toBe(true);

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(syncOfflineSessionAccess).toHaveBeenCalledWith(false, {
      redirectOpenClients: true,
    });
    expectNoStoredAuthState();

    await act(async () => {
      deferred.resolve(revalidatedUser);
      await Promise.resolve();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expectNoStoredAuthState();
    await waitForSensitiveClientCleanup();
  });

  it("reconciles bootstrap persistence after sensitive logout cleanup", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
    };
    const revalidatedUser = {
      ...mockUser,
      permissions: ["employees.read"],
    };
    const currentUserDeferred = createDeferredPromise<typeof revalidatedUser>();
    const setUserDeferred = createDeferredPromise<void>();
    const sensitiveCleanupDeferred = createDeferredPromise<void>();
    const actualSetUser = authStorage.setUser.bind(authStorage);
    const setUserSpy = vi
      .spyOn(authStorage, "setUser")
      .mockImplementationOnce(async (user) => {
        await setUserDeferred.promise;
        return actualSetUser(user);
      });
    const removeUserSpy = vi.spyOn(authStorage, "removeUser");
    vi.mocked(clearSensitiveClientState).mockImplementationOnce(
      () => sensitiveCleanupDeferred.promise
    );

    let logoutPromise: Promise<void> | null = null;

    try {
      await actualSetUser(mockUser);
      mockGetCurrentUser.mockReturnValueOnce(currentUserDeferred.promise);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await waitFor(() => {
        expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        currentUserDeferred.resolve(revalidatedUser);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(setUserSpy).toHaveBeenCalledTimes(1);
      });

      act(() => {
        logoutPromise = Promise.resolve(result.current.logout());
      });

      expect(removeUserSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ clearOfflineVaultTables: false })
      );

      await act(async () => {
        setUserDeferred.resolve();
        await Promise.resolve();
      });

      expect(removeUserSpy).toHaveBeenCalledTimes(1);
      await waitForSensitiveClientCleanup();

      await act(async () => {
        sensitiveCleanupDeferred.resolve();
        await logoutPromise;
      });

      await waitFor(() => {
        expect(removeUserSpy).toHaveBeenCalledTimes(2);
      });
      expect(removeUserSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ clearOfflineVaultTables: true })
      );
    } finally {
      setUserDeferred.resolve();
      sensitiveCleanupDeferred.resolve();
      await Promise.allSettled([logoutPromise]);
      setUserSpy.mockRestore();
      removeUserSpy.mockRestore();
    }
  });

  it("retries barrier vault-table cleanup after sensitive logout cleanup finishes", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
    };
    const revalidatedUser = {
      ...mockUser,
      permissions: ["employees.read"],
    };
    const currentUserDeferred = createDeferredPromise<typeof revalidatedUser>();
    const setUserDeferred = createDeferredPromise<void>();
    const sensitiveCleanupError = new Error("cleanup failed");
    const actualSetUser = authStorage.setUser.bind(authStorage);
    const setUserSpy = vi
      .spyOn(authStorage, "setUser")
      .mockImplementationOnce(async (user) => {
        await setUserDeferred.promise;
        return actualSetUser(user);
      });
    const removeUserSpy = vi.spyOn(authStorage, "removeUser");
    vi.mocked(clearSensitiveClientState).mockRejectedValueOnce(
      sensitiveCleanupError
    );

    try {
      await actualSetUser(mockUser);
      mockGetCurrentUser.mockReturnValueOnce(currentUserDeferred.promise);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      await waitFor(() => {
        expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        currentUserDeferred.resolve(revalidatedUser);
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(setUserSpy).toHaveBeenCalledTimes(1);
      });

      act(() => {
        result.current.logout();
      });

      expect(removeUserSpy).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ clearOfflineVaultTables: false })
      );

      await waitForSensitiveClientCleanup();

      await act(async () => {
        setUserDeferred.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(removeUserSpy).toHaveBeenCalledTimes(2);
      });

      expect(removeUserSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ clearOfflineVaultTables: true })
      );
    } finally {
      setUserSpy.mockRestore();
      removeUserSpy.mockRestore();
    }
  });

  it("clears stale stored auth data when revalidation fails", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
    };

    await authStorage.setUser(mockUser);
    mockGetCurrentUser.mockRejectedValue(
      Object.assign(new Error("Unauthorized"), {
        code: "HTTP_401",
      })
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expectNoStoredAuthState();
    await waitForSensitiveClientCleanup();
    expect(syncOfflineSessionAccess).toHaveBeenCalledWith(false, {
      redirectOpenClients: false,
    });
  });

  it("clears stale stored auth data when localized API revalidation returns 401", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
    };

    await authStorage.setUser(mockUser);
    mockGetCurrentUser.mockRejectedValue(
      new AuthApiError("Nicht authentifiziert.", undefined, 401)
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.bootstrapRecoveryReason).toBeNull();
    expectNoStoredAuthState();
    await waitForSensitiveClientCleanup();
    expect(syncOfflineSessionAccess).toHaveBeenCalledWith(false, {
      redirectOpenClients: false,
    });
    await authStorage.waitForInFlightVaultTableCleanup();
  });

  it("keeps cached auth state when bootstrap revalidation fails for a transient error after an automatic retry", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(mockUser);
    mockGetCurrentUser.mockRejectedValue(
      new AuthApiError(
        "Current user fetch failed: Network down",
        undefined,
        undefined,
        "NETWORK_ERROR"
      )
    );
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.bootstrapRecoveryReason).toBe("network");
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(2);
    await expect(authStorage.getUser()).resolves.toEqual(mockUser);
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0]?.[0]).toBe(
      "Auth bootstrap revalidation failed; holding protected routes behind recovery UI."
    );
  });

  it("holds routes behind recovery UI when the offline vault chunk is temporarily unavailable", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(mockUser);
    const getUserSpy = vi
      .spyOn(authStorage, "getUser")
      .mockRejectedValueOnce(
        createRecoverableLazyModuleError(
          "Stored offline auth data is temporarily unavailable on this device.",
          new TypeError("Failed to fetch dynamically imported module")
        )
      );
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.bootstrapRecoveryReason).toBe("network");
      expect(authStorage.hasStoredUser()).toBe(true);
      expect(clearSensitiveClientState).not.toHaveBeenCalled();
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy.mock.calls[0]?.[0]).toBe(
        "Failed to restore persisted auth state because a lazy auth chunk could not be loaded; keeping the route behind recovery UI."
      );
    } finally {
      consoleWarnSpy.mockRestore();
      getUserSpy.mockRestore();
    }
  });

  it("keeps cached auth state when Android bootstrap reports missing connectivity", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(mockUser);
    mockGetCurrentUser.mockRejectedValue(
      Object.assign(
        new Error("Android auth requires an active internet connection"),
        {
          code: "NETWORK_OFFLINE",
        }
      )
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.bootstrapRecoveryReason).toBeNull();
    await expect(authStorage.getUser()).resolves.toEqual(mockUser);
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
  });

  it("does not restore a superseded native user after replacement persistence fails", async () => {
    const storedUser = {
      id: "stored-user",
      name: "Stored User",
      email: "stored-user@secpal.dev",
      emailVerified: true,
    };
    const confirmedUser = {
      id: "confirmed-user",
      name: "Confirmed User",
      email: "confirmed-user@secpal.dev",
      emailVerified: true,
    };
    await authStorage.setUser(storedUser);
    const nativeGetCurrentUser = vi.fn().mockResolvedValue(confirmedUser);
    installNativeAuthBridge({ getCurrentUser: nativeGetCurrentUser });
    const vaultClearSpy = vi
      .spyOn(db.vaultProfile, "clear")
      .mockRejectedValue(new Error("IndexedDB clear failed"));
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    try {
      const firstProvider = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(firstProvider.result.current.bootstrapRecoveryReason).toBe(
          "network"
        );
      });

      expect(firstProvider.result.current.user).toBeNull();
      expect(firstProvider.result.current.isAuthenticated).toBe(false);
      expect(authStorage.hasStoredUser()).toBe(false);
      firstProvider.unmount();
      clearOfflineVaultSession();
      nativeGetCurrentUser.mockRejectedValue(
        Object.assign(new Error("Network unavailable."), {
          code: "NETWORK_OFFLINE",
        })
      );

      const restartedProvider = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(restartedProvider.result.current.bootstrapRecoveryReason).toBe(
          "network"
        );
      });
      expect(restartedProvider.result.current.user).toBeNull();
      expect(restartedProvider.result.current.isAuthenticated).toBe(false);

      vaultClearSpy.mockRestore();
      nativeGetCurrentUser.mockResolvedValue(confirmedUser);
      act(() => restartedProvider.result.current.retryBootstrap());

      await waitFor(() => {
        expect(restartedProvider.result.current.user).toEqual(confirmedUser);
      });
      expect(restartedProvider.result.current.isAuthenticated).toBe(true);
      expect(
        restartedProvider.result.current.bootstrapRecoveryReason
      ).toBeNull();
      expect(authStorage.hasStoredUser()).toBe(true);
    } finally {
      consoleWarnSpy.mockRestore();
      vaultClearSpy.mockRestore();
    }
  });

  it("clears the cached vault session before persisting a revalidated native identity", async () => {
    const storedUser = {
      id: "stored-user",
      name: "Stored User",
      email: "stored-user@secpal.dev",
      emailVerified: true,
    };
    const confirmedUser = {
      id: "confirmed-user",
      name: "Confirmed User",
      email: "confirmed-user@secpal.dev",
      emailVerified: true,
    };
    await authStorage.setUser(storedUser);
    const activeVaultSession = requireActiveOfflineVaultSession();
    installNativeAuthBridge({
      getCurrentUser: vi.fn().mockResolvedValue(confirmedUser),
    });
    const replacementPersistence = createDeferredPromise<{
      status: "superseded";
    }>();
    vi.spyOn(authStorage, "setUser").mockReturnValueOnce(
      replacementPersistence.promise
    );
    const provider = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    try {
      await waitFor(() => {
        expect(
          localStorage.getItem(AUTH_USER_REVALIDATION_REQUIRED_KEY)
        ).not.toBeNull();
      });

      expect(getActiveOfflineVaultSession()).toBeNull();
      expect(activeVaultSession.rootKeyBytes).toEqual(
        new Uint8Array(activeVaultSession.rootKeyBytes.length)
      );
    } finally {
      await act(async () => {
        replacementPersistence.resolve({ status: "superseded" });
        await replacementPersistence.promise;
      });
      provider.unmount();
    }
  });

  it("invalidates a superseded native user when randomUUID is unavailable", async () => {
    const storedUser = {
      id: "stored-user",
      name: "Stored User",
      email: "stored-user@secpal.dev",
      emailVerified: true,
    };
    const confirmedUser = {
      id: "confirmed-user",
      name: "Confirmed User",
      email: "confirmed-user@secpal.dev",
      emailVerified: true,
    };
    await authStorage.setUser(storedUser);
    installNativeAuthBridge({
      getCurrentUser: vi.fn().mockResolvedValue(confirmedUser),
    });
    const originalCrypto = Object.getOwnPropertyDescriptor(
      globalThis,
      "crypto"
    );
    const currentCrypto = globalThis.crypto;

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        subtle: currentCrypto.subtle,
        getRandomValues: currentCrypto.getRandomValues.bind(currentCrypto),
        randomUUID: undefined,
      } as unknown as Crypto,
    });

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.user).toEqual(confirmedUser);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.bootstrapRecoveryReason).toBeNull();
      expect(
        localStorage.getItem(AUTH_USER_REVALIDATION_REQUIRED_KEY)
      ).toBeNull();
      await expect(authStorage.getUser()).resolves.toEqual(confirmedUser);
    } finally {
      if (originalCrypto) {
        Object.defineProperty(globalThis, "crypto", originalCrypto);
      }
    }
  });

  it("skips stored-session revalidation when the native bridge reports the device offline", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const nativeBridge = {
      login: vi.fn(),
      logout: vi.fn(),
      getCurrentUser: vi.fn(),
      isNetworkAvailable: vi.fn().mockResolvedValue(false),
    };
    const authGlobal = globalThis as typeof globalThis & {
      SecPalNativeAuthBridge?: typeof nativeBridge;
    };
    const originalNativeBridge = authGlobal.SecPalNativeAuthBridge;

    authGlobal.SecPalNativeAuthBridge = nativeBridge;
    await persistAuthUser(mockUser);

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.bootstrapRecoveryReason).toBeNull();
      expect(nativeBridge.isNetworkAvailable).toHaveBeenCalledTimes(1);
      expect(nativeBridge.getCurrentUser).not.toHaveBeenCalled();
    } finally {
      if (originalNativeBridge === undefined) {
        delete authGlobal.SecPalNativeAuthBridge;
      } else {
        authGlobal.SecPalNativeAuthBridge = originalNativeBridge;
      }
    }
  });

  it("stops blocking protected routes when bootstrap revalidation exceeds the startup deadline after an automatic retry", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const deferred = createDeferredPromise<typeof mockUser>();

    await persistAuthUser(mockUser);
    const getUserSpy = vi
      .spyOn(authStorage, "getUser")
      .mockResolvedValue(mockUser);
    mockGetCurrentUser.mockImplementation(() => deferred.promise);
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    vi.useFakeTimers();

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
        }
      });
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
      });
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(2);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.bootstrapRecoveryReason).toBe("timeout");
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        `Auth bootstrap revalidation exceeded ${BOOTSTRAP_REVALIDATION_TIMEOUT_MS}ms.`
      );
    } finally {
      consoleWarnSpy.mockRestore();
      getUserSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("keeps the silent timeout retry in control when the original bootstrap request rejects afterward", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const firstAttempt = createDeferredPromise<typeof mockUser>();
    const secondAttempt = createDeferredPromise<typeof mockUser>();

    await authStorage.setUser(mockUser);
    const getUserSpy = vi
      .spyOn(authStorage, "getUser")
      .mockResolvedValue(mockUser);
    mockGetCurrentUser
      .mockImplementationOnce(() => firstAttempt.promise)
      .mockImplementationOnce(() => secondAttempt.promise);
    vi.useFakeTimers();

    const { result, unmount } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    try {
      await act(async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
        }
      });

      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        vi.advanceTimersByTime(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
        firstAttempt.reject(new Error("Simulated stale bootstrap failure"));
        await Promise.resolve();
      });

      await act(async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
        }
      });

      expect(mockGetCurrentUser).toHaveBeenCalledTimes(2);
      expect(result.current.isLoading).toBe(true);
      expect(result.current.bootstrapRecoveryReason).toBeNull();

      unmount();

      await act(async () => {
        secondAttempt.resolve(mockUser);
        await Promise.resolve();
      });
    } finally {
      getUserSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("grants a fresh silent retry for each manual retryBootstrap cycle after the recovery UI was shown", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const deferred = createDeferredPromise<typeof mockUser>();

    await authStorage.setUser(mockUser);
    const getUserSpy = vi
      .spyOn(authStorage, "getUser")
      .mockResolvedValue(mockUser);
    // All attempts stall so each cycle hits the timeout twice (auto-retry + final timeout).
    mockGetCurrentUser.mockImplementation(() => deferred.promise);
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    vi.useFakeTimers();

    const { result, unmount } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    try {
      await act(async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
        }
      });

      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
        await Promise.resolve();
      });

      await act(async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
        }
      });

      expect(mockGetCurrentUser).toHaveBeenCalledTimes(2);

      await act(async () => {
        vi.advanceTimersByTime(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
        await Promise.resolve();
      });

      expect(result.current.bootstrapRecoveryReason).toBe("timeout");

      // User clicks Retry — this should reset the silent-retry flag and issue a
      // third call, then a fourth (auto-retry), before showing recovery again.
      act(() => {
        result.current.retryBootstrap();
      });

      expect(result.current.isLoading).toBe(true);
      expect(result.current.bootstrapRecoveryReason).toBeNull();

      await act(async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
        }
      });

      expect(mockGetCurrentUser).toHaveBeenCalledTimes(3);

      await act(async () => {
        vi.advanceTimersByTime(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
        await Promise.resolve();
      });

      await act(async () => {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          await Promise.resolve();
        }
      });

      expect(mockGetCurrentUser).toHaveBeenCalledTimes(4);

      await act(async () => {
        vi.advanceTimersByTime(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
        await Promise.resolve();
      });

      expect(result.current.bootstrapRecoveryReason).toBe("timeout");
      expect(consoleWarnSpy).toHaveBeenCalledTimes(2);
      expect(consoleWarnSpy).toHaveBeenNthCalledWith(
        1,
        `Auth bootstrap revalidation exceeded ${BOOTSTRAP_REVALIDATION_TIMEOUT_MS}ms.`
      );
      expect(consoleWarnSpy).toHaveBeenNthCalledWith(
        2,
        `Auth bootstrap revalidation exceeded ${BOOTSTRAP_REVALIDATION_TIMEOUT_MS}ms.`
      );
    } finally {
      unmount();
      consoleWarnSpy.mockRestore();
      getUserSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("does not silently retry deterministic bootstrap API client errors", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await persistAuthUser(mockUser);
    mockGetCurrentUser.mockRejectedValueOnce(
      new AuthApiError(
        "Current user fetch failed: expected application/json response from API",
        undefined,
        404
      )
    );
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.bootstrapRecoveryReason).toBe("network");
    });

    expect(result.current.user).toEqual(mockUser);
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0]?.[0]).toBe(
      "Auth bootstrap revalidation failed with a non-retriable response; holding protected routes behind recovery UI."
    );
  });

  it("retries browser-session bootstrap from recovery on /login without a restored user snapshot", async () => {
    window.history.replaceState({}, "", "/login");
    const firstFailure = new AuthApiError(
      "Current user fetch failed: expected application/json response from API",
      undefined,
      404
    );
    const recoveredUser = {
      id: "1",
      name: "Recovered User",
      email: "recovered@secpal.dev",
      emailVerified: true,
    };
    mockGetCurrentUser
      .mockRejectedValueOnce(firstFailure)
      .mockResolvedValueOnce(recoveredUser);
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.bootstrapRecoveryReason).toBe("network");
      expect(result.current.isAuthenticated).toBe(false);
    });

    act(() => {
      result.current.retryBootstrap();
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(mockGetCurrentUser).toHaveBeenCalledTimes(2);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0]?.[0]).toBe(
      "Auth bootstrap revalidation failed with a non-retriable response; holding protected routes behind recovery UI."
    );
  });

  it("does not silently retry an AuthApiError without a numeric status field", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await persistAuthUser(mockUser);
    // AuthApiError with no status and no HTTP_ code — deterministic API-layer
    // error that should not trigger the silent retry path.
    mockGetCurrentUser.mockRejectedValueOnce(
      new AuthApiError("Current user fetch failed: non-retriable client error")
    );
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.bootstrapRecoveryReason).toBe("network");
    });

    expect(result.current.user).toEqual(mockUser);
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0]?.[0]).toBe(
      "Auth bootstrap revalidation failed with a non-retriable response; holding protected routes behind recovery UI."
    );
  });

  it("does not silently retry API base URL configuration failures", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await persistAuthUser(mockUser);
    mockGetCurrentUser.mockRejectedValueOnce(
      new ApiBaseUrlConfigurationError("Invalid API base URL")
    );
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.bootstrapRecoveryReason).toBe("network");
    });

    expect(result.current.user).toEqual(mockUser);
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
    expect(consoleWarnSpy.mock.calls[0]?.[0]).toBe(
      "Auth bootstrap revalidation failed with a non-retriable response; holding protected routes behind recovery UI."
    );
  });

  it("stops the loading spinner when the browser goes offline during the automatic bootstrap retry", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await persistAuthUser(mockUser);

    // First bootstrap attempt stalls so the bootstrap timeout fires and
    // schedules an automatic silent retry (which sets `isLoading=true` and
    // bumps `bootstrapRetryKey`). Once that re-runs the bootstrap effect,
    // the browser is offline, so revalidation must be skipped without
    // leaving protected routes spinning.
    mockGetCurrentUser.mockReturnValueOnce(new Promise(() => undefined));
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const onLineSpy = vi
      .spyOn(window.navigator, "onLine", "get")
      .mockReturnValue(true);
    vi.useFakeTimers();

    const { result, unmount } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    try {
      expect(result.current.isLoading).toBe(true);
      await vi.waitFor(() => {
        expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
      });
      onLineSpy.mockReturnValue(false);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
      });

      await vi.waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.bootstrapRecoveryReason).toBeNull();
      // The offline shortcut must not issue another revalidation after the
      // automatic retry re-runs the bootstrap effect.
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
      expect(consoleWarnSpy).not.toHaveBeenCalled();
    } finally {
      unmount();
      onLineSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("keeps stored auth when offline without revalidation", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await persistAuthUser(mockUser);

    const onLineSpy = vi
      .spyOn(window.navigator, "onLine", "get")
      .mockReturnValue(false);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(mockGetCurrentUser).not.toHaveBeenCalled();

    onLineSpy.mockRestore();
  });

  it("keeps user authenticated when the CSRF token rotates while offline", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await persistAuthUser(mockUser);

    // Rotate the CSRF token to verify the stored vault state is rewrapped
    // instead of being treated as unreadable while offline.
    setCsrfTokenCookie("rotated-csrf-token");

    const onLineSpy = vi
      .spyOn(window.navigator, "onLine", "get")
      .mockReturnValue(false);

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    } finally {
      onLineSpy.mockRestore();
    }
  });

  it("removes corrupted legacy auth state through async vault cleanup", async () => {
    localStorage.setItem("auth_user", "invalid-json");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.user).toBeNull();
    await waitFor(() => {
      expect(localStorage.getItem("auth_user")).toBeNull();
    });
  });

  it("skips broader client cleanup when persisted auth restore fails before login state exists", async () => {
    const restoreError = new Error("restore failed");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const getUserSpy = vi
      .spyOn(authStorage, "getUser")
      .mockRejectedValueOnce(restoreError);
    const clearSpy = vi.spyOn(authStorage, "clear");

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(clearSpy).toHaveBeenCalledWith({
        clearOfflineVaultTables: true,
      });
      expect(clearSensitiveClientState).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to restore persisted auth state:",
        restoreError
      );
      expect(syncOfflineSessionAccess).toHaveBeenCalledWith(false, {
        redirectOpenClients: false,
      });
    } finally {
      clearSpy.mockRestore();
      getUserSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  it("login stores user", async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await act(async () => {
      await result.current.login(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    await expectEncryptedStoredUser(mockUser);
  });

  it("logout clears user", async () => {
    const mockUser = { id: "1", name: "Test User", email: "test@secpal.dev" };

    await persistAuthUser(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expectNoStoredAuthState();
  });

  it("waits for storage and analytics logout cleanup before clearing broader client state", async () => {
    const mockUser = { id: "1", name: "Test User", email: "test@secpal.dev" };

    await persistAuthUser(mockUser);

    const storageClear = createDeferredPromise<void>();
    const analyticsReset = createDeferredPromise<void>();

    const clearSpy = vi
      .spyOn(authStorage, "clear")
      .mockImplementation(() => storageClear.promise);
    mockAnalyticsResetForLogout.mockImplementation(
      () => analyticsReset.promise
    );

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      void result.current.logout();

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalledWith({
          clearOfflineVaultTables: false,
        });
        expect(mockAnalyticsResetForLogout).toHaveBeenCalled();
      });
      expect(clearSensitiveClientState).not.toHaveBeenCalled();

      storageClear.resolve();

      await act(async () => {
        await Promise.resolve();
      });

      expect(clearSensitiveClientState).not.toHaveBeenCalled();

      analyticsReset.resolve();

      await waitForSensitiveClientCleanup();
    } finally {
      clearSpy.mockRestore();
    }
  });

  it("does not skip vault-table cleanup when sensitive logout barrier setup fails", async () => {
    const mockUser = { id: "1", name: "Test User", email: "test@secpal.dev" };
    const barrierError = new Error("barrier unavailable");
    const clearSpy = vi.spyOn(authStorage, "clear").mockResolvedValue();
    const beginBarrierSpy = vi
      .spyOn(authStorage, "beginSensitiveLogoutBarrierCleanup")
      .mockImplementationOnce(() => {
        throw barrierError;
      });
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    try {
      await persistAuthUser(mockUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(clearSpy).toHaveBeenCalledWith({
        clearOfflineVaultTables: true,
      });
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to create a sensitive logout barrier before cleanup:",
        barrierError
      );
    } finally {
      consoleWarnSpy.mockRestore();
      beginBarrierSpy.mockRestore();
      clearSpy.mockRestore();
    }
  });

  it("does not run destructive logout cleanup when lifecycle lock acquisition fails", async () => {
    const mockUser = { id: "1", name: "Test User", email: "test@secpal.dev" };
    const lockError = new DOMException(
      "Secure offline vault lifecycle coordination requires Web Locks.",
      "NotSupportedError"
    );
    const waitForLockSpy = vi
      .spyOn(authStorage, "waitForSensitiveLogoutCleanupLock")
      .mockRejectedValueOnce(lockError);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await persistAuthUser(mockUser);
    vi.mocked(clearSensitiveClientState).mockClear();

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(clearSensitiveClientState).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to clear sensitive client state during logout:",
        lockError
      );
    } finally {
      consoleErrorSpy.mockRestore();
      waitForLockSpy.mockRestore();
    }
  });

  it("logout resolves only after sensitive client cleanup settles", async () => {
    const mockUser = { id: "1", name: "Test User", email: "test@secpal.dev" };

    await persistAuthUser(mockUser);

    const cleanupDeferred = createDeferredPromise<void>();
    vi.mocked(clearSensitiveClientState).mockImplementationOnce(
      () => cleanupDeferred.promise
    );

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let settled = false;
    let logoutPromise!: Promise<void>;

    act(() => {
      logoutPromise = Promise.resolve(result.current.logout());
      void logoutPromise.then(() => {
        settled = true;
      });
    });

    await waitForSensitiveClientCleanup();
    expect(settled).toBe(false);

    cleanupDeferred.resolve();

    await act(async () => {
      await logoutPromise;
    });

    expect(settled).toBe(true);
  });

  it("continues logout cleanup when analytics reset does not settle", async () => {
    const mockUser = { id: "1", name: "Test User", email: "test@secpal.dev" };

    await persistAuthUser(mockUser);

    mockAnalyticsResetForLogout.mockImplementationOnce(
      () => new Promise<void>(() => undefined)
    );

    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      vi.useFakeTimers();

      let logoutPromise!: Promise<void>;

      act(() => {
        logoutPromise = Promise.resolve(result.current.logout());
      });

      expect(clearSensitiveClientState).not.toHaveBeenCalled();

      await vi.advanceTimersByTimeAsync(5_000);
      await Promise.resolve();
      await Promise.resolve();
      expect(clearSensitiveClientState).toHaveBeenCalledTimes(1);
      await act(async () => {
        await logoutPromise;
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Timed out waiting for analytics reset during logout; continuing with best-effort sensitive cleanup."
      );
    } finally {
      vi.useRealTimers();
      consoleWarnSpy.mockRestore();
    }
  });

  it("logs sensitive cleanup failures when logout cleanup rejects before the timeout", async () => {
    const mockUser = { id: "1", name: "Test User", email: "test@secpal.dev" };
    const sensitiveCleanupError = new Error("cleanup failed");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    await persistAuthUser(mockUser);
    vi.mocked(clearSensitiveClientState).mockRejectedValueOnce(
      sensitiveCleanupError
    );
    vi.mocked(clearBrowserPushClientState).mockClear();

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to clear sensitive client state during logout:",
        sensitiveCleanupError
      );
      expect(clearBrowserPushClientState).toHaveBeenCalledTimes(1);
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("reconciles stale logout owners before removing the current cleanup owner", async () => {
    const mockUser = { id: "1", name: "Test User", email: "test@secpal.dev" };
    const callOrder: string[] = [];
    const completeSpy = vi
      .spyOn(authStorage, "completeStaleSensitiveLogoutBarrierCleanup")
      .mockImplementation((ownerToken: string) => {
        callOrder.push(`complete:${ownerToken}`);
      });
    const endSpy = vi
      .spyOn(authStorage, "endSensitiveLogoutBarrierCleanup")
      .mockImplementation((ownerToken: string) => {
        callOrder.push(`end:${ownerToken}`);
      });

    await persistAuthUser(mockUser);

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.logout();
      });

      expect(callOrder).toHaveLength(2);
      expect(callOrder[0]?.split(":")[0]).toBe("complete");
      expect(callOrder[1]?.split(":")[0]).toBe("end");
      expect(callOrder[0]?.split(":")[1]).toBe(callOrder[1]?.split(":")[1]);
    } finally {
      completeSpy.mockRestore();
      endSpy.mockRestore();
    }
  });

  it("does not resolve logout or accept login until destructive cleanup settles", async () => {
    const firstUser = { id: "1", name: "Test User", email: "test@secpal.dev" };
    const secondUser = {
      id: "2",
      name: "Next User",
      email: "next@secpal.dev",
    };

    await persistAuthUser(firstUser);

    const cleanupDeferred = createDeferredPromise<void>();
    vi.mocked(clearSensitiveClientState).mockImplementationOnce(
      () => cleanupDeferred.promise
    );
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const setUserSpy = vi
      .spyOn(authStorage, "setUser")
      .mockResolvedValue({ status: "persisted" });

    vi.useFakeTimers();

    let loginSettled = false;
    let logoutSettled = false;
    let logoutPromise!: Promise<void>;
    let loginPromise!: Promise<void>;

    try {
      act(() => {
        logoutPromise = Promise.resolve(result.current.logout());
        void logoutPromise.then(() => {
          logoutSettled = true;
        });
      });

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(clearSensitiveClientState).toHaveBeenCalledTimes(1);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
        await Promise.resolve();
      });

      expect(logoutSettled).toBe(false);

      act(() => {
        loginPromise = Promise.resolve(result.current.login(secondUser));
        void loginPromise.then(() => {
          loginSettled = true;
        });
      });

      await act(async () => {
        await Promise.resolve();
      });

      expect(loginSettled).toBe(false);
      expect(result.current.user).toBeNull();
      expect(setUserSpy).not.toHaveBeenCalled();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(5_000);
        await Promise.resolve();
      });

      expect(loginSettled).toBe(false);
      expect(result.current.user).toBeNull();
      expect(setUserSpy).not.toHaveBeenCalled();
      expect(consoleWarnSpy).not.toHaveBeenCalledWith(
        "Timed out waiting for trailing logout cleanup during logout; continuing with best-effort barrier teardown."
      );

      cleanupDeferred.resolve();

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(logoutSettled).toBe(true);
      expect(loginSettled).toBe(true);
      expect(setUserSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "2",
          name: "Next User",
          email: "next@secpal.dev",
        }),
        expect.objectContaining({ shouldCommit: expect.any(Function) })
      );
      expect(result.current.user).toEqual(
        expect.objectContaining({
          id: "2",
          name: "Next User",
          email: "next@secpal.dev",
        })
      );
    } finally {
      cleanupDeferred.resolve();
      consoleWarnSpy.mockRestore();
      setUserSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("does not accept a new login after destructive cleanup fails", async () => {
    const firstUser = {
      id: "cleanup-owner",
      name: "Cleanup Owner",
      email: "cleanup-owner@secpal.dev",
    };
    const secondUser = {
      id: "next-user",
      name: "Next User",
      email: "next-user@secpal.dev",
    };
    const cleanupError = new Error("IndexedDB cleanup rolled back");

    await persistAuthUser(firstUser);
    vi.mocked(clearSensitiveClientState).mockRejectedValueOnce(cleanupError);
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const setUserSpy = vi.spyOn(authStorage, "setUser");

    await act(async () => {
      await result.current.logout();
    });
    setUserSpy.mockClear();

    await act(async () => {
      await result.current.login(secondUser);
    });

    expect(setUserSpy).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(authStorage.hasLogoutBarrier()).toBe(true);
    setUserSpy.mockRestore();
  });

  it("lets a newer logout supersede a login waiting for cleanup", async () => {
    await persistAuthUser({
      id: "1",
      name: "Current User",
      email: "current@secpal.dev",
    });
    const cleanup = createDeferredPromise<void>();
    vi.mocked(clearSensitiveClientState).mockImplementationOnce(
      () => cleanup.promise
    );
    const setUserSpy = vi
      .spyOn(authStorage, "setUser")
      .mockResolvedValue({ status: "persisted" });
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    setUserSpy.mockClear();

    let firstLogout!: Promise<void>;
    let login!: Promise<void>;
    let newerLogout!: Promise<void>;
    act(() => {
      firstLogout = Promise.resolve(result.current.logout());
      login = Promise.resolve(
        result.current.login({
          id: "2",
          name: "Next User",
          email: "next@secpal.dev",
        })
      );
      newerLogout = Promise.resolve(result.current.logout());
    });

    cleanup.resolve();
    await act(async () => {
      await Promise.all([firstLogout, login, newerLogout]);
    });

    expect(setUserSpy).not.toHaveBeenCalled();
    expect(result.current.user).toBeNull();
    expect(authStorage.hasLogoutBarrier()).toBe(true);
  });

  it("runs a real second logout after login resumes from a timed-out trailing cleanup handoff", async () => {
    const firstUser = { id: "1", name: "Test User", email: "test@secpal.dev" };
    const secondUser = {
      id: "2",
      name: "Next User",
      email: "next@secpal.dev",
    };

    await persistAuthUser(firstUser);

    const pushCleanupDeferred = createDeferredPromise<void>();
    vi.mocked(clearBrowserPushClientState).mockImplementationOnce(
      () => pushCleanupDeferred.promise
    );
    const clearSpy = vi.spyOn(authStorage, "clear");
    const beginBarrierSpy = vi.spyOn(
      authStorage,
      "beginSensitiveLogoutBarrierCleanup"
    );
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    vi.useFakeTimers();

    try {
      act(() => {
        void result.current.logout();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(5_000);
        await Promise.resolve();
      });

      act(() => {
        void result.current.login(secondUser);
      });
      await act(async () => {
        await Promise.resolve();
        await vi.advanceTimersByTimeAsync(5_000);
        await Promise.resolve();
      });

      const clearCallCountAfterFirstLogout = clearSpy.mock.calls.length;

      act(() => {
        void result.current.logout();
      });
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(clearSpy.mock.calls.length).toBeGreaterThan(
        clearCallCountAfterFirstLogout
      );
      expect(clearSpy).toHaveBeenLastCalledWith(
        expect.objectContaining({
          clearOfflineVaultTables: false,
        })
      );
      expect(beginBarrierSpy).toHaveBeenCalledTimes(2);
      expect(localStorage.getItem("auth_logout_barrier")).not.toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Timed out waiting for trailing logout cleanup during logout; continuing with best-effort barrier teardown."
      );
    } finally {
      pushCleanupDeferred.resolve();
      beginBarrierSpy.mockRestore();
      clearSpy.mockRestore();
      consoleWarnSpy.mockRestore();
      vi.useRealTimers();
    }
  });

  it("upgrades an in-flight non-sensitive auth clear when logout is requested", async () => {
    const storageClear = createDeferredPromise<void>();
    const restoreError = new Error("restore failed");
    const barrierError = new Error("barrier unavailable");
    const clearSpy = vi
      .spyOn(authStorage, "clear")
      .mockImplementation(() => storageClear.promise);
    const getUserSpy = vi
      .spyOn(authStorage, "getUser")
      .mockRejectedValue(restoreError);
    const beginBarrierSpy = vi
      .spyOn(authStorage, "beginSensitiveLogoutBarrierCleanup")
      .mockImplementationOnce(() => {
        throw barrierError;
      });
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalledWith({
          clearOfflineVaultTables: true,
        });
      });
      expect(clearSpy).toHaveBeenCalledTimes(1);
      expect(syncOfflineSessionAccess).toHaveBeenNthCalledWith(1, false, {
        redirectOpenClients: false,
      });

      expect(clearSensitiveClientState).not.toHaveBeenCalled();

      let logoutPromise!: Promise<void>;
      act(() => {
        logoutPromise = Promise.resolve(result.current.logout());
      });

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to create a sensitive logout barrier before cleanup:",
        barrierError
      );
      expect(syncOfflineSessionAccess).toHaveBeenCalledTimes(2);
      expect(syncOfflineSessionAccess).toHaveBeenNthCalledWith(2, false, {
        redirectOpenClients: true,
      });

      await act(async () => {
        storageClear.resolve();
        await logoutPromise;
      });
      await waitForSensitiveClientCleanup();
      expect(syncOfflineSessionAccess).toHaveBeenCalledTimes(2);
    } finally {
      consoleWarnSpy.mockRestore();
      beginBarrierSpy.mockRestore();
      clearSpy.mockRestore();
      getUserSpy.mockRestore();
    }
  });

  it("skips vault-table cleanup when a cross-tab logout upgrades an in-flight restore clear", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const restoreError = new Error("restore failed");
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const getUserSpy = vi
      .spyOn(authStorage, "getUser")
      .mockRejectedValueOnce(restoreError);
    const actualClear = authStorage.clear.bind(authStorage);
    const clearSpy = vi
      .spyOn(authStorage, "clear")
      .mockImplementationOnce(async (options) => {
        const clearPromise = actualClear(options);

        const crossTabLogoutEvent = new Event("storage");
        Object.defineProperties(crossTabLogoutEvent, {
          key: { value: "auth_logout_barrier" },
          oldValue: { value: null },
          newValue: { value: "1" },
          storageArea: { value: localStorage },
        } satisfies Partial<
          Record<keyof StorageEventInit, PropertyDescriptor>
        >);

        window.dispatchEvent(crossTabLogoutEvent);

        return clearPromise;
      });
    let vaultProfileClearSpy: ReturnType<typeof vi.spyOn> | null = null;

    try {
      await persistAuthUser(mockUser);
      vaultProfileClearSpy = vi.spyOn(db.vaultProfile, "clear");

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalledTimes(1);
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await waitForSensitiveClientCleanup();

      expect(vaultProfileClearSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to restore persisted auth state:",
        restoreError
      );
    } finally {
      vaultProfileClearSpy?.mockRestore();
      clearSpy.mockRestore();
      getUserSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    }
  });

  it("waits for in-flight vault table cleanup before full logout deletes broader client state", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const restoreError = new Error("restore failed");
    const vaultProfileClear = createDeferredPromise<void>();
    const getUserSpy = vi
      .spyOn(authStorage, "getUser")
      .mockRejectedValueOnce(restoreError);
    const vaultProfileClearSpy = vi
      .spyOn(db.vaultProfile, "clear")
      .mockImplementationOnce(
        () =>
          Dexie.waitFor(vaultProfileClear.promise) as ReturnType<
            typeof db.vaultProfile.clear
          >
      );

    try {
      await persistAuthUser(mockUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(vaultProfileClearSpy).toHaveBeenCalledTimes(1);
      });

      act(() => {
        result.current.logout();
      });

      expect(clearSensitiveClientState).not.toHaveBeenCalled();

      await act(async () => {
        vaultProfileClear.resolve();
        await Promise.resolve();
      });

      await waitForSensitiveClientCleanup();
      expect(localStorage.getItem("auth_logout_barrier")).not.toBeNull();
    } finally {
      vaultProfileClearSpy.mockRestore();
      getUserSpy.mockRestore();
    }
  });

  it("does not restore persisted auth state when logout lands during initial restore", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const restoreDeferred = createDeferredPromise<void>();
    const actualGetUser = authStorage.getUser.bind(authStorage);
    const getUserSpy = vi
      .spyOn(authStorage, "getUser")
      .mockImplementationOnce(async () => {
        await restoreDeferred.promise;
        return actualGetUser();
      });

    try {
      await persistAuthUser(mockUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      act(() => {
        result.current.logout();
      });

      await act(async () => {
        restoreDeferred.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expectNoStoredAuthState();
      await waitForSensitiveClientCleanup();
    } finally {
      getUserSpy.mockRestore();
    }
  });

  it("continues logout cleanup when analytics reset fails", async () => {
    const mockUser = { id: "1", name: "Test User", email: "test@secpal.dev" };
    const analyticsError = new Error("analytics reset failed");
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);

    await persistAuthUser(mockUser);
    mockAnalyticsResetForLogout.mockRejectedValue(analyticsError);

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      act(() => {
        result.current.logout();
      });

      await waitForSensitiveClientCleanup();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "Failed to reset analytics state during logout:",
        analyticsError
      );
    } finally {
      consoleWarnSpy.mockRestore();
    }
  });

  it("logout stores the logout barrier", async () => {
    const mockUser = { id: "1", name: "Test User", email: "test@secpal.dev" };

    await persistAuthUser(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.logout();
    });

    expect(localStorage.getItem("auth_user")).toBeNull();
    await waitFor(() => {
      expect(localStorage.getItem("auth_logout_barrier")).not.toBeNull();
    });
    await waitForSensitiveClientCleanup();
  });

  it("keeps the skip marker until overlapping full logout cleanups finish", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const firstSensitiveCleanup = createDeferredPromise<void>();
    const secondSensitiveCleanup = createDeferredPromise<void>();

    vi.mocked(clearSensitiveClientState)
      .mockImplementationOnce(() => firstSensitiveCleanup.promise)
      .mockImplementationOnce(() => secondSensitiveCleanup.promise);

    await persistAuthUser(mockUser);

    const firstAuth = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });
    const secondAuth = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(firstAuth.result.current.isAuthenticated).toBe(true);
      expect(secondAuth.result.current.isAuthenticated).toBe(true);
    });

    let firstLogout: Promise<void> | null = null;
    let secondLogout: Promise<void> | null = null;

    try {
      act(() => {
        firstLogout = Promise.resolve(firstAuth.result.current.logout());
        secondLogout = Promise.resolve(secondAuth.result.current.logout());
      });

      await waitForSensitiveClientCleanup();

      expect(localStorage.getItem("auth_logout_skip_vault_table_cleanup")).toBe(
        "1"
      );

      await act(async () => {
        firstSensitiveCleanup.resolve();
        await Promise.resolve();
      });

      await waitForSensitiveClientCleanup(2);
      expect(localStorage.getItem("auth_logout_skip_vault_table_cleanup")).toBe(
        "1"
      );

      await act(async () => {
        secondSensitiveCleanup.resolve();
        await Promise.all([firstLogout, secondLogout]);
      });

      await waitFor(() => {
        expect(localStorage.getItem("auth_logout_barrier")).not.toBeNull();
        expect(
          localStorage.getItem("auth_logout_skip_vault_table_cleanup")
        ).toBeNull();
      });
    } finally {
      firstSensitiveCleanup.resolve();
      secondSensitiveCleanup.resolve();
      await Promise.allSettled([firstLogout, secondLogout]);
    }
  });

  it("locks the vault locally without deleting wrapped offline data and unlocks it again", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const revalidatedUser = {
      id: "1",
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(mockUser);
    mockGetCurrentUser.mockResolvedValueOnce(revalidatedUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    vi.mocked(syncOfflineSessionAccess).mockClear();

    act(() => {
      result.current.lock?.();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isVaultLocked).toBe(true);
    expect(result.current.sensitiveUiState).toBe("vault-locked");
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
    expect(syncOfflineSessionAccess).toHaveBeenCalledWith(true);
    expect(syncOfflineSessionAccess).not.toHaveBeenCalledWith(false);

    await act(async () => {
      await result.current.unlock?.();
    });

    expect(result.current.isVaultLocked).toBe(false);
    expect(result.current.sensitiveUiState).toBe("clear");
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(revalidatedUser);
  });

  it("keeps a locked vault recoverable when its wrapper is temporarily unavailable", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    await authStorage.setUser(mockUser);
    mockGetCurrentUser.mockResolvedValueOnce(mockUser);
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      result.current.lock?.();
    });
    const storedVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);
    vi.spyOn(authStorage, "unlockVault").mockResolvedValueOnce({
      status: "unavailable",
    });

    let didUnlock = true;
    await act(async () => {
      didUnlock = (await result.current.unlock?.()) ?? false;
    });

    expect(didUnlock).toBe(false);
    expect(result.current.isVaultLocked).toBe(true);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBe(storedVaultState);
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
  });

  it("lets a logout barrier supersede a successful in-flight vault unlock", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    await authStorage.setUser(mockUser);
    mockGetCurrentUser.mockResolvedValueOnce(mockUser);
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      result.current.lock?.();
    });
    vi.spyOn(authStorage, "unlockVault").mockImplementationOnce(async () => {
      localStorage.setItem("auth_logout_barrier", "1");
      return { status: "unlocked", user: mockUser };
    });

    let didUnlock = true;
    await act(async () => {
      didUnlock = (await result.current.unlock?.()) ?? false;
    });

    expect(didUnlock).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.isVaultLocked).toBe(false);
    expect(localStorage.getItem("auth_logout_barrier")).not.toBeNull();
    expect(syncOfflineSessionAccess).toHaveBeenCalledWith(false, {
      redirectOpenClients: true,
    });
  });

  it("does not let an older vault unlock overwrite a completed cross-tab revalidation", async () => {
    const storedUser = {
      id: "stored-user",
      name: "Stored User",
      email: "stored-user@secpal.dev",
      emailVerified: true,
    };
    const confirmedUser = {
      id: "confirmed-user",
      name: "Confirmed User",
      email: "confirmed-user@secpal.dev",
      emailVerified: true,
    };
    await authStorage.setUser(storedUser);
    mockGetCurrentUser.mockResolvedValueOnce(storedUser);
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      result.current.lock?.();
    });

    const deferredUnlock = createDeferredPromise<{
      status: "unlocked";
      user: typeof storedUser;
    }>();
    vi.spyOn(authStorage, "unlockVault").mockReturnValueOnce(
      deferredUnlock.promise
    );
    vi.spyOn(authStorage, "getUser").mockResolvedValueOnce(confirmedUser);
    let unlockPromise: Promise<boolean> | undefined;

    await act(async () => {
      unlockPromise = result.current.unlock?.();
      await Promise.resolve();
    });

    act(() => {
      localStorage.setItem(AUTH_USER_REVALIDATION_REQUIRED_KEY, "new-owner");
      dispatchLocalStorageEvent(
        AUTH_USER_REVALIDATION_REQUIRED_KEY,
        "new-owner"
      );

      localStorage.removeItem(AUTH_USER_REVALIDATION_REQUIRED_KEY);
      dispatchLocalStorageEvent(
        AUTH_USER_REVALIDATION_REQUIRED_KEY,
        null,
        "new-owner"
      );
    });

    await waitFor(() => {
      expect(result.current.user).toEqual(confirmedUser);
    });

    let didUnlock = true;
    await act(async () => {
      deferredUnlock.resolve({ status: "unlocked", user: storedUser });
      didUnlock = (await unlockPromise) ?? false;
    });

    expect(didUnlock).toBe(false);
    expect(result.current.user).toEqual(confirmedUser);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("shows a visual privacy shield without locking or clearing the offline vault session", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(mockUser);
    mockGetCurrentUser.mockResolvedValueOnce(mockUser);

    const lockVault = vi.spyOn(authStorage, "lockVault");
    const storedVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

    expect(storedVaultState).not.toBeNull();
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      result.current.showPrivacyShield?.();
    });

    expect(result.current.sensitiveUiState).toBe("privacy-shield");
    expect(result.current.isPrivacyShielded).toBe(true);
    expect(result.current.isVaultLocked).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBe(storedVaultState);
    expect(lockVault).not.toHaveBeenCalled();
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(mockUser);

    act(() => {
      result.current.hidePrivacyShield?.();
    });

    expect(result.current.sensitiveUiState).toBe("clear");
    expect(result.current.isPrivacyShielded).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
  });

  it("keeps offline session access enabled when bootstrap restores a locked vault", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(mockUser);
    authStorage.lockVault();
    vi.mocked(syncOfflineSessionAccess).mockClear();

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isVaultLocked).toBe(true);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(syncOfflineSessionAccess).toHaveBeenCalledWith(true);
    expect(syncOfflineSessionAccess).not.toHaveBeenCalledWith(false);
  });

  it("unlocks the vault after a browser-session CSRF token rotation while locked", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const revalidatedUser = {
      id: "1",
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(mockUser);
    mockGetCurrentUser.mockResolvedValueOnce(revalidatedUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      result.current.lock?.();
    });

    setCsrfTokenCookie("rotated-csrf-token");

    await act(async () => {
      await result.current.unlock?.();
    });

    expect(result.current.isVaultLocked).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(revalidatedUser);
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
  });

  it("keeps the vault unlockable after a locked tab receives a cross-tab vault rewrite and the CSRF token rotates again", async () => {
    const user = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(user);

    const initialVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

    expect(initialVaultState).not.toBeNull();

    setCsrfTokenCookie("intermediate-csrf-token");
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(user);

    const rewrittenVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

    expect(rewrittenVaultState).not.toBeNull();
    expect(rewrittenVaultState).not.toBe(initialVaultState);

    clearRecentAuthVaultKeyMaterials();
    localStorage.setItem(AUTH_VAULT_STORAGE_KEY, initialVaultState as string);
    clearOfflineVaultSession();
    setCsrfTokenCookie("test-csrf-token");
    await expect(readPersistedAuthUserFromVault()).resolves.toEqual(user);
    clearOfflineVaultSession();
    localStorage.setItem(AUTH_VAULT_STORAGE_KEY, initialVaultState as string);

    mockGetCurrentUser.mockResolvedValueOnce(user);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      result.current.lock?.();
    });

    await waitFor(() => {
      expect(result.current.isVaultLocked).toBe(true);
    });

    setCsrfTokenCookie("intermediate-csrf-token");
    localStorage.setItem(AUTH_VAULT_STORAGE_KEY, rewrittenVaultState as string);

    act(() => {
      const storageEvent = new Event("storage");

      Object.defineProperties(storageEvent, {
        key: {
          configurable: true,
          value: AUTH_VAULT_STORAGE_KEY,
        },
        oldValue: {
          configurable: true,
          value: initialVaultState as string,
        },
        newValue: {
          configurable: true,
          value: rewrittenVaultState as string,
        },
        storageArea: {
          configurable: true,
          value: localStorage,
        },
      });

      window.dispatchEvent(storageEvent);
    });

    await waitFor(() => {
      expect(result.current.isVaultLocked).toBe(true);
    });

    setCsrfTokenCookie("final-csrf-token");

    await act(async () => {
      await result.current.unlock?.();
    });

    expect(result.current.isVaultLocked).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(user);
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
  });

  it("propagates vault lock and unlock state across tabs", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const revalidatedUser = {
      id: "1",
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(mockUser);
    mockGetCurrentUser.mockResolvedValueOnce(revalidatedUser);
    const storedVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

    expect(storedVaultState).not.toBeNull();

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      localStorage.setItem(AUTH_VAULT_LOCK_KEY, "1");
      const crossTabLockEvent = new Event("storage");
      Object.defineProperties(crossTabLockEvent, {
        key: { value: AUTH_VAULT_LOCK_KEY },
        newValue: { value: "1" },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(crossTabLockEvent);
    });

    await waitFor(() => {
      expect(result.current.isVaultLocked).toBe(true);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(clearSensitiveClientState).not.toHaveBeenCalled();

    act(() => {
      localStorage.removeItem(AUTH_VAULT_LOCK_KEY);
      const crossTabUnlockEvent = new Event("storage");
      Object.defineProperties(crossTabUnlockEvent, {
        key: { value: AUTH_VAULT_LOCK_KEY },
        newValue: { value: null },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(crossTabUnlockEvent);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.isVaultLocked).toBe(false);
    expect(result.current.user).toEqual(revalidatedUser);
  });

  it("does not logout when auth vault storage changes while the vault is locked", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    await authStorage.setUser(mockUser);

    const storedVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

    expect(storedVaultState).not.toBeNull();

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      localStorage.setItem(AUTH_VAULT_LOCK_KEY, "1");
      const crossTabLockEvent = new Event("storage");
      Object.defineProperties(crossTabLockEvent, {
        key: { value: AUTH_VAULT_LOCK_KEY },
        newValue: { value: "1" },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(crossTabLockEvent);
    });

    await waitFor(() => {
      expect(result.current.isVaultLocked).toBe(true);
    });

    act(() => {
      localStorage.setItem(AUTH_VAULT_STORAGE_KEY, storedVaultState as string);
      const crossTabVaultStateEvent = new Event("storage");
      Object.defineProperties(crossTabVaultStateEvent, {
        key: { value: AUTH_VAULT_STORAGE_KEY },
        oldValue: { value: storedVaultState },
        newValue: { value: storedVaultState },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(crossTabVaultStateEvent);
    });

    await waitFor(() => {
      expect(result.current.isVaultLocked).toBe(true);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("auth_logout_barrier")).toBeNull();
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
  });

  it("updates isAuthenticated when user changes", async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isAuthenticated).toBe(false);

    await act(async () => {
      await result.current.login({
        id: "1",
        name: "User",
        email: "u@e.com",
      });
    });

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it("logs out when session:expired event is emitted", async () => {
    const mockUser = { id: 1, name: "Test User", email: "test@secpal.dev" };
    await persistAuthUser(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      sessionEvents.emit("session:expired");
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });
    await waitForSensitiveClientCleanup();
    expectNoStoredAuthState();
    expect(syncOfflineSessionAccess).toHaveBeenCalledWith(false, {
      redirectOpenClients: false,
    });
  });

  it("does not logout when session:expired is emitted but not logged in", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isAuthenticated).toBe(false);

    // This should not throw or cause issues
    act(() => {
      sessionEvents.emit("session:expired");
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it("revalidates browser-session auth when another tab removes local auth storage without a logout barrier", async () => {
    const mockUser = { id: "1", name: "Test User", email: "test@secpal.dev" };

    const storedUser = await persistAuthUser(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      localStorage.removeItem(AUTH_VAULT_STORAGE_KEY);
      const crossTabLogoutEvent = new Event("storage");
      Object.defineProperties(crossTabLogoutEvent, {
        key: { value: AUTH_VAULT_STORAGE_KEY },
        oldValue: { value: storedUser },
        newValue: { value: null },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(crossTabLogoutEvent);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user).toEqual({
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    });
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_logout_barrier")).toBeNull();
  });

  it("drops restored in-memory auth state when pageshow finds no stored user", async () => {
    const mockUser = { id: 1, name: "Test User", email: "test@secpal.dev" };

    await persistAuthUser(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      localStorage.removeItem(AUTH_VAULT_STORAGE_KEY);
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true })
      );
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
  });

  it("ignores stale auth storage that reappears after explicit logout", async () => {
    const mockUser = { id: 1, name: "Test User", email: "test@secpal.dev" };

    await persistAuthUser(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      result.current.logout();
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    await act(async () => {
      const newStoredValue = await persistAuthUser(mockUser);
      const staleAuthEvent = new Event("storage");
      Object.defineProperties(staleAuthEvent, {
        key: { value: AUTH_VAULT_STORAGE_KEY },
        oldValue: { value: null },
        newValue: { value: newStoredValue },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(staleAuthEvent);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    expect(result.current.user).toBeNull();
    await waitFor(() => {
      expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
    });
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("adopts a cross-tab user after the logout barrier is removed", async () => {
    const nextUser = {
      id: "next-user",
      name: "Next User",
      email: "next-user@secpal.dev",
      emailVerified: true,
    };
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitForTestingLibrary(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      localStorage.setItem("auth_logout_barrier", "other-tab");
      dispatchLocalStorageEvent("auth_logout_barrier", "other-tab");
    });

    await waitForTestingLibrary(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    const persistedUser = await persistAuthUser(nextUser);

    act(() => {
      dispatchLocalStorageEvent(AUTH_VAULT_STORAGE_KEY, persistedUser);
      dispatchLocalStorageEvent("auth_logout_barrier", null, "other-tab");
    });

    await waitForTestingLibrary(() => {
      expect(result.current.user).toEqual(nextUser);
    });
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("keeps a completed cross-tab logout logged out when no replacement snapshot exists", async () => {
    const getUserSpy = vi.spyOn(authStorage, "getUser");
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitForTestingLibrary(() => {
      expect(result.current.isLoading).toBe(false);
    });
    getUserSpy.mockClear();

    act(() => {
      localStorage.setItem("auth_logout_barrier", "other-tab");
      dispatchLocalStorageEvent("auth_logout_barrier", "other-tab");
      localStorage.removeItem("auth_logout_barrier");
      dispatchLocalStorageEvent("auth_logout_barrier", null, "other-tab");
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(getUserSpy).not.toHaveBeenCalled();
  });

  it("rejects BFCache-style auth restoration after explicit logout", async () => {
    const mockUser = { id: 1, name: "Test User", email: "test@secpal.dev" };

    await persistAuthUser(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      result.current.logout();
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    await act(async () => {
      await persistAuthUser(mockUser);
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true })
      );
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    expect(result.current.user).toBeNull();
    await waitFor(() => {
      expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
    });
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("preserves the persisted skip marker when BFCache restore sees another tab's logout barrier", async () => {
    const mockUser = { id: 1, name: "Test User", email: "test@secpal.dev" };
    const vaultProfileClearSpy = vi.spyOn(db.vaultProfile, "clear");

    try {
      await persistAuthUser(mockUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      act(() => {
        localStorage.setItem("auth_logout_barrier", "1");
        authStorage.setSkipBarrierVaultTableCleanup(true);
        window.dispatchEvent(
          new PageTransitionEvent("pageshow", { persisted: true })
        );
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      await waitFor(() => {
        expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
      });

      expect(vaultProfileClearSpy).not.toHaveBeenCalled();
      expect(localStorage.getItem("auth_logout_barrier")).not.toBeNull();
      expect(localStorage.getItem("auth_logout_skip_vault_table_cleanup")).toBe(
        "1"
      );
      expect(clearSensitiveClientState).not.toHaveBeenCalled();
    } finally {
      vaultProfileClearSpy.mockRestore();
    }
  });

  it("honors a late skip-marker upgrade when BFCache reconciliation sees a logout barrier", async () => {
    const mockUser = { id: 1, name: "Test User", email: "test@secpal.dev" };
    const vaultProfileClearSpy = vi.spyOn(db.vaultProfile, "clear");

    try {
      await persistAuthUser(mockUser);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      act(() => {
        localStorage.setItem("auth_logout_barrier", "1");
        window.dispatchEvent(
          new PageTransitionEvent("pageshow", { persisted: true })
        );
      });

      authStorage.setSkipBarrierVaultTableCleanup(true);

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      await waitFor(() => {
        expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
      });

      expect(vaultProfileClearSpy).not.toHaveBeenCalled();
      expect(localStorage.getItem("auth_logout_barrier")).not.toBeNull();
      expect(localStorage.getItem("auth_logout_skip_vault_table_cleanup")).toBe(
        "1"
      );
    } finally {
      vaultProfileClearSpy.mockRestore();
    }
  });

  it("does not bootstrap /v1/me when a logout barrier blocks stale auth storage", async () => {
    const staleUser = { id: 1, name: "Stale User", email: "stale@secpal.dev" };

    await persistAuthUser(staleUser);
    localStorage.setItem("auth_logout_barrier", "1");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    await waitFor(() => {
      expectNoStoredAuthState();
    });
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it("honors a persisted skip marker when bootstrap sees an existing logout barrier", async () => {
    const staleUser = { id: 1, name: "Stale User", email: "stale@secpal.dev" };
    const vaultProfileClearSpy = vi.spyOn(db.vaultProfile, "clear");

    try {
      await persistAuthUser(staleUser);
      localStorage.setItem("auth_logout_barrier", "1");
      authStorage.setSkipBarrierVaultTableCleanup(true);
      vaultProfileClearSpy.mockClear();

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.user).toBeNull();
        expect(result.current.isAuthenticated).toBe(false);
        expect(result.current.isLoading).toBe(false);
      });

      await waitFor(() => {
        expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).toBeNull();
      });

      expect(vaultProfileClearSpy).not.toHaveBeenCalled();
      expect(localStorage.getItem("auth_logout_barrier")).not.toBeNull();
      expect(localStorage.getItem("auth_logout_skip_vault_table_cleanup")).toBe(
        "1"
      );
      expect(mockGetCurrentUser).not.toHaveBeenCalled();
    } finally {
      vaultProfileClearSpy.mockRestore();
    }
  });

  it("ignores storage events for keys other than supported auth storage keys", async () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      const otherKeyEvent = new Event("storage");
      Object.defineProperties(otherKeyEvent, {
        key: { value: "some_other_key" },
        newValue: { value: null },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(otherKeyEvent);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
  });

  it("drops a superseded user when another tab requires revalidation", async () => {
    const storedUser = {
      id: "stored-user",
      name: "Stored User",
      email: "stored-user@secpal.dev",
      emailVerified: true,
    };
    await persistAuthUser(storedUser);
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
    const activeVaultSession = requireActiveOfflineVaultSession();

    act(() => {
      localStorage.setItem(AUTH_USER_REVALIDATION_REQUIRED_KEY, "1");
      const revalidationEvent = new Event("storage");
      Object.defineProperties(revalidationEvent, {
        key: { value: AUTH_USER_REVALIDATION_REQUIRED_KEY },
        newValue: { value: "1" },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(revalidationEvent);
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.bootstrapRecoveryReason).toBe("network");
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
    expect(getActiveOfflineVaultSession()).toBeNull();
    expect(activeVaultSession.rootKeyBytes).toEqual(
      new Uint8Array(activeVaultSession.rootKeyBytes.length)
    );
  });

  it("adopts a cross-tab native user when revalidation completes", async () => {
    const storedUser = {
      id: "stored-user",
      name: "Stored User",
      email: "stored-user@secpal.dev",
      emailVerified: true,
    };
    const confirmedUser = {
      id: "confirmed-user",
      name: "Confirmed User",
      email: "confirmed-user@secpal.dev",
      emailVerified: true,
    };
    await persistAuthUser(storedUser);
    installNativeAuthBridge({
      getCurrentUser: vi.fn().mockResolvedValue(storedUser),
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitForTestingLibrary(() => {
      expect(result.current.user).toEqual(storedUser);
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      localStorage.setItem(AUTH_USER_REVALIDATION_REQUIRED_KEY, "owner");
      const markerAdded = new Event("storage");
      Object.defineProperties(markerAdded, {
        key: { value: AUTH_USER_REVALIDATION_REQUIRED_KEY },
        newValue: { value: "owner" },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(markerAdded);
    });

    expect(result.current.isAuthenticated).toBe(false);

    await expect(authStorage.setUser(confirmedUser)).resolves.toEqual({
      status: "persisted",
    });

    act(() => {
      const vaultWritten = new Event("storage");
      Object.defineProperties(vaultWritten, {
        key: { value: AUTH_VAULT_STORAGE_KEY },
        newValue: {
          value: localStorage.getItem(AUTH_VAULT_STORAGE_KEY),
        },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(vaultWritten);
    });

    act(() => {
      localStorage.removeItem(AUTH_USER_REVALIDATION_REQUIRED_KEY);
      const markerRemoved = new Event("storage");
      Object.defineProperties(markerRemoved, {
        key: { value: AUTH_USER_REVALIDATION_REQUIRED_KEY },
        oldValue: { value: "owner" },
        newValue: { value: null },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(markerRemoved);
    });

    await waitForTestingLibrary(() => {
      expect(result.current.user).toEqual(confirmedUser);
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.bootstrapRecoveryReason).toBeNull();
  });

  it("restarts native bootstrap when another tab removes the local snapshot", async () => {
    const storedUser = {
      id: "stored-user",
      name: "Stored User",
      email: "stored-user@secpal.dev",
      emailVerified: true,
    };
    const rehydratedUser = {
      id: "rehydrated-user",
      name: "Rehydrated User",
      email: "rehydrated-user@secpal.dev",
      emailVerified: true,
    };
    await persistAuthUser(storedUser);
    const getCurrentUser = vi
      .fn()
      .mockResolvedValueOnce(storedUser)
      .mockResolvedValueOnce(rehydratedUser);
    installNativeAuthBridge({ getCurrentUser });
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitForTestingLibrary(() => {
      expect(result.current.user).toEqual(storedUser);
      expect(result.current.isLoading).toBe(false);
    });
    expect(getCurrentUser).toHaveBeenCalledTimes(1);

    act(() => {
      clearOfflineVaultSession();
      const previousVaultState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);
      localStorage.removeItem(AUTH_VAULT_STORAGE_KEY);
      dispatchLocalStorageEvent(
        AUTH_VAULT_STORAGE_KEY,
        null,
        previousVaultState
      );
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.bootstrapRecoveryReason).toBeNull();

    await waitForTestingLibrary(() => {
      expect(result.current.user).toEqual(rehydratedUser);
      expect(result.current.isLoading).toBe(false);
    });

    expect(getCurrentUser).toHaveBeenCalledTimes(2);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.bootstrapRecoveryReason).toBeNull();
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    expect(localStorage.getItem("auth_logout_barrier")).toBeNull();
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
  });

  it("does not let an older cross-tab restore overwrite a completed newer revalidation", async () => {
    const storedUser = {
      id: "stored-user",
      name: "Stored User",
      email: "stored-user@secpal.dev",
      emailVerified: true,
    };
    await persistAuthUser(storedUser);
    installNativeAuthBridge({
      getCurrentUser: vi.fn().mockResolvedValue(storedUser),
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitForTestingLibrary(() => {
      expect(result.current.user).toEqual(storedUser);
    });

    const confirmedUser = {
      id: "confirmed-user",
      name: "Confirmed User",
      email: "confirmed-user@secpal.dev",
      emailVerified: true,
    };
    const crossTabRead = createDeferredPromise<typeof storedUser>();
    vi.spyOn(authStorage, "getUser")
      .mockReturnValueOnce(crossTabRead.promise)
      .mockResolvedValueOnce(confirmedUser);

    act(() => {
      dispatchLocalStorageEvent(AUTH_USER_REVALIDATION_REQUIRED_KEY, null);

      localStorage.setItem(AUTH_USER_REVALIDATION_REQUIRED_KEY, "new-owner");
      dispatchLocalStorageEvent(
        AUTH_USER_REVALIDATION_REQUIRED_KEY,
        "new-owner"
      );
    });

    act(() => {
      localStorage.removeItem(AUTH_USER_REVALIDATION_REQUIRED_KEY);
      dispatchLocalStorageEvent(
        AUTH_USER_REVALIDATION_REQUIRED_KEY,
        null,
        "new-owner"
      );
    });

    await waitForTestingLibrary(() => {
      expect(result.current.user).toEqual(confirmedUser);
    });

    await act(async () => {
      crossTabRead.resolve(storedUser);
      await crossTabRead.promise;
    });

    expect(result.current.user).toEqual(confirmedUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.bootstrapRecoveryReason).toBeNull();
  });

  it("ignores an older cross-tab restore failure after a newer revalidation completes", async () => {
    const storedUser = {
      id: "stored-user",
      name: "Stored User",
      email: "stored-user@secpal.dev",
      emailVerified: true,
    };
    const confirmedUser = {
      id: "confirmed-user",
      name: "Confirmed User",
      email: "confirmed-user@secpal.dev",
      emailVerified: true,
    };
    await persistAuthUser(storedUser);
    installNativeAuthBridge({
      getCurrentUser: vi.fn().mockResolvedValue(storedUser),
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitForTestingLibrary(() => {
      expect(result.current.user).toEqual(storedUser);
    });

    const crossTabRead = createDeferredPromise<typeof storedUser>();
    vi.spyOn(authStorage, "getUser")
      .mockReturnValueOnce(crossTabRead.promise)
      .mockResolvedValueOnce(confirmedUser);

    act(() => {
      dispatchLocalStorageEvent(AUTH_USER_REVALIDATION_REQUIRED_KEY, null);

      localStorage.setItem(AUTH_USER_REVALIDATION_REQUIRED_KEY, "new-owner");
      dispatchLocalStorageEvent(
        AUTH_USER_REVALIDATION_REQUIRED_KEY,
        "new-owner"
      );

      localStorage.removeItem(AUTH_USER_REVALIDATION_REQUIRED_KEY);
      dispatchLocalStorageEvent(
        AUTH_USER_REVALIDATION_REQUIRED_KEY,
        null,
        "new-owner"
      );
    });

    await waitForTestingLibrary(() => {
      expect(result.current.user).toEqual(confirmedUser);
    });

    await act(async () => {
      crossTabRead.reject(new Error("stale vault read failed"));
      await Promise.resolve();
    });

    expect(result.current.user).toEqual(confirmedUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.bootstrapRecoveryReason).toBeNull();
  });

  it("does not let an in-flight cross-tab restore undo a local vault lock", async () => {
    const storedUser = {
      id: "stored-user",
      name: "Stored User",
      email: "stored-user@secpal.dev",
      emailVerified: true,
    };
    await persistAuthUser(storedUser);
    installNativeAuthBridge({
      getCurrentUser: vi.fn().mockResolvedValue(storedUser),
    });
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitForTestingLibrary(() => {
      expect(result.current.user).toEqual(storedUser);
    });

    const crossTabRead = createDeferredPromise<typeof storedUser>();
    vi.spyOn(authStorage, "getUser").mockReturnValueOnce(crossTabRead.promise);

    act(() => {
      dispatchLocalStorageEvent(
        AUTH_VAULT_STORAGE_KEY,
        localStorage.getItem(AUTH_VAULT_STORAGE_KEY)
      );
      result.current.lock?.();
    });

    await act(async () => {
      crossTabRead.resolve(storedUser);
      await crossTabRead.promise;
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isVaultLocked).toBe(true);
  });

  it("updates auth state when another tab logs in", async () => {
    window.history.replaceState({}, "", "/onboarding/complete");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isAuthenticated).toBe(false);

    const newUser = {
      id: "2",
      name: "Cross-Tab User",
      email: "cross@secpal.dev",
      emailVerified: false,
    };

    await act(async () => {
      const storedUser = await persistAuthUser(newUser);
      const crossTabLoginEvent = new Event("storage");
      Object.defineProperties(crossTabLoginEvent, {
        key: { value: AUTH_VAULT_STORAGE_KEY },
        oldValue: { value: null },
        newValue: { value: storedUser },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(crossTabLoginEvent);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user).toEqual(newUser);
    expect(syncOfflineSessionAccess).toHaveBeenCalledWith(true);
  });

  it("clears auth state when cross-tab auth storage contains invalid JSON", async () => {
    const mockUser = { id: 1, name: "Test User", email: "test@secpal.dev" };

    const storedUser = await persistAuthUser(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      // Write the corrupt value so localStorage matches the event (real browser
      // cross-tab writes keep newValue and the actual storage in sync).
      localStorage.setItem(AUTH_VAULT_STORAGE_KEY, "{invalid json{{");
      const invalidJsonEvent = new Event("storage");
      Object.defineProperties(invalidJsonEvent, {
        key: { value: AUTH_VAULT_STORAGE_KEY },
        oldValue: { value: storedUser },
        newValue: { value: "{invalid json{{" },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(invalidJsonEvent);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user).toEqual({
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    });
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
  });

  it("does not log out an authenticated browser session when another /login tab temporarily clears local auth storage", async () => {
    window.history.replaceState({}, "", "/login");
    await persistAuthUser({
      id: 1,
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
    });

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      localStorage.removeItem(AUTH_VAULT_STORAGE_KEY);

      const clearedStorageEvent = new Event("storage");
      Object.defineProperties(clearedStorageEvent, {
        key: { value: AUTH_VAULT_STORAGE_KEY },
        oldValue: { value: "previous-vault-state" },
        newValue: { value: null },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(clearedStorageEvent);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual({
      id: "1",
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
      emailVerified: false,
    });
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_logout_barrier")).toBeNull();
  });

  it("resets the prefetch cache when cross-tab auth storage removal revalidates to a logged-out browser session", async () => {
    window.history.replaceState({}, "", "/");
    await persistAuthUser({
      id: 1,
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
    });
    const resetPrefetchCacheSpy = vi.spyOn(prefetch, "resetPrefetchCache");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    mockGetCurrentUser.mockRejectedValueOnce(
      Object.assign(new Error("Unauthenticated."), {
        code: "HTTP_401",
      })
    );

    act(() => {
      localStorage.removeItem(AUTH_VAULT_STORAGE_KEY);

      const clearedStorageEvent = new Event("storage");
      Object.defineProperties(clearedStorageEvent, {
        key: { value: AUTH_VAULT_STORAGE_KEY },
        oldValue: { value: "previous-vault-state" },
        newValue: { value: null },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(clearedStorageEvent);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    expect(resetPrefetchCacheSpy).toHaveBeenCalledTimes(1);
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_logout_barrier")).toBeNull();
  });

  it("resets the prefetch cache when cross-tab auth storage removal falls back to logged out after a no-csrf network failure", async () => {
    window.history.replaceState({}, "", "/");
    await persistAuthUser({
      id: 1,
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
    });
    const resetPrefetchCacheSpy = vi.spyOn(prefetch, "resetPrefetchCache");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.isLoading).toBe(false);
    });

    clearCsrfTokenCookie();
    mockGetCurrentUser.mockRejectedValueOnce(
      new AuthApiError(
        "Current user fetch failed: Failed to fetch",
        undefined,
        undefined,
        "NETWORK_ERROR"
      )
    );

    act(() => {
      localStorage.removeItem(AUTH_VAULT_STORAGE_KEY);

      const clearedStorageEvent = new Event("storage");
      Object.defineProperties(clearedStorageEvent, {
        key: { value: AUTH_VAULT_STORAGE_KEY },
        oldValue: { value: "previous-vault-state" },
        newValue: { value: null },
        storageArea: { value: localStorage },
      } satisfies Partial<Record<keyof StorageEventInit, PropertyDescriptor>>);
      window.dispatchEvent(clearedStorageEvent);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.bootstrapRecoveryReason).toBeNull();
    expect(resetPrefetchCacheSpy).toHaveBeenCalledTimes(1);
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
    expect(localStorage.getItem("auth_logout_barrier")).toBeNull();
  });

  it("reconciles stored user state when pageshow fires and user is still in storage", async () => {
    // Use the same shape as the beforeEach bootstrap mock so that localStorage
    // stays consistent after the bootstrap revalidation overwrites it.
    const mockUser = {
      id: 1,
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
    };

    await persistAuthUser(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.isAuthenticated).toBe(true);
    });

    vi.mocked(syncOfflineSessionAccess).mockClear();

    // Simulate BFCache restore (persisted=true): pageshow triggers reconciliation with stored user still present.
    act(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true })
      );
    });

    await waitFor(() => {
      expect(syncOfflineSessionAccess).toHaveBeenCalledWith(true);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).not.toBeNull();
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
  });

  it("clears a visual privacy shield when pageshow restores a real vault lock", async () => {
    const mockUser = {
      id: 1,
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
    };

    await persistAuthUser(mockUser);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      result.current.showPrivacyShield?.();
    });

    expect(result.current.isPrivacyShielded).toBe(true);
    expect(result.current.sensitiveUiState).toBe("privacy-shield");

    act(() => {
      authStorage.lockVault?.();
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true })
      );
    });

    await waitFor(() => {
      expect(result.current.isVaultLocked).toBe(true);
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.isPrivacyShielded).toBe(false);
    expect(result.current.sensitiveUiState).toBe("vault-locked");
  });

  it("ignores pageshow that is not a BFCache restore (persisted=false)", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: false })
      );
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
  });
});
