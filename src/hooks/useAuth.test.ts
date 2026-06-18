// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { afterEach, describe, it, expect, beforeEach, vi } from "vitest";
import {
  renderHook,
  act,
  waitFor as waitForTestingLibrary,
} from "@testing-library/react";
import {
  AuthProvider,
  BOOTSTRAP_REVALIDATION_TIMEOUT_MS,
} from "../contexts/AuthContext";
import { useAuth } from "./useAuth";
import { AuthApiError } from "../services/authApi";
import { sanitizePersistedAuthUser } from "../services/authState";
import { authStorage } from "../services/storage";
import { sessionEvents } from "../services/sessionEvents";
import { clearSensitiveClientState } from "../lib/clientStateCleanup";
import {
  AUTH_VAULT_LOCK_KEY,
  AUTH_VAULT_STORAGE_KEY,
  clearRecentAuthVaultKeyMaterials,
  clearOfflineVaultSession,
  readPersistedAuthUserFromVault,
} from "../lib/offlineVault";
import { db } from "../lib/db";
import { syncOfflineSessionAccess } from "../lib/serviceWorkerSession";

const {
  mockGetCurrentUser,
  mockAnalyticsResetForLogout,
  mockAnalyticsResumeAuthenticatedSession,
} = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockAnalyticsResetForLogout: vi.fn(),
  mockAnalyticsResumeAuthenticatedSession: vi.fn(),
}));

const AUTH_BOOTSTRAP_TIMEOUT_MS = 20_000;

vi.mock("../services/authApi", async () => {
  const actual = await vi.importActual("../services/authApi");
  return {
    ...actual,
    getCurrentUser: mockGetCurrentUser,
  };
});

vi.mock("../lib/clientStateCleanup", () => ({
  clearSensitiveClientState: vi.fn().mockResolvedValue(undefined),
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

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
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
    localStorage.clear();
    clearOfflineVaultSession();
    window.history.replaceState({}, "", "/login");
    setCsrfTokenCookie("test-csrf-token");
    vi.clearAllMocks();
    mockGetCurrentUser.mockReset();
    vi.mocked(syncOfflineSessionAccess).mockReset();
    vi.mocked(clearSensitiveClientState).mockReset();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    sessionEvents.reset();
    mockGetCurrentUser.mockResolvedValue({
      id: 1,
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
    });
    mockAnalyticsResetForLogout.mockReset();
    mockAnalyticsResetForLogout.mockResolvedValue(undefined);
    mockAnalyticsResumeAuthenticatedSession.mockReset();
    vi.mocked(clearSensitiveClientState).mockResolvedValue(undefined);
    vi.mocked(syncOfflineSessionAccess).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    clearOfflineVaultSession();
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

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
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

  it("skips vault-table cleanup when logout lands during bootstrap setUser", async () => {
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
        await actualSetUser(user);
      });
    const removeUserSpy = vi.spyOn(authStorage, "removeUser");
    vi.mocked(clearSensitiveClientState).mockImplementationOnce(
      () => sensitiveCleanupDeferred.promise
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

      await act(async () => {
        setUserDeferred.resolve();
        await Promise.resolve();
      });

      await waitFor(() => {
        expect(removeUserSpy).toHaveBeenCalledTimes(2);
      });

      expect(removeUserSpy).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ clearOfflineVaultTables: false })
      );

      await waitForSensitiveClientCleanup();
      await act(async () => {
        sensitiveCleanupDeferred.resolve();
        await Promise.resolve();
      });
    } finally {
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
        await actualSetUser(user);
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
    mockGetCurrentUser.mockImplementation(() => deferred.promise);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    });

    await waitFor(
      () => {
        expect(result.current.isLoading).toBe(false);
        expect(result.current.user).toEqual(mockUser);
        expect(result.current.isAuthenticated).toBe(true);
        expect(result.current.bootstrapRecoveryReason).toBe("timeout");
        expect(mockGetCurrentUser).toHaveBeenCalledTimes(2);
      },
      BOOTSTRAP_REVALIDATION_TIMEOUT_MS * 2 + 2_000
    );
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
    } finally {
      unmount();
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

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.bootstrapRecoveryReason).toBe("network");
    });

    expect(result.current.user).toEqual(mockUser);
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
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

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.bootstrapRecoveryReason).toBe("network");
    });

    expect(result.current.user).toEqual(mockUser);
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
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

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    });

    const onLineSpy = vi
      .spyOn(window.navigator, "onLine", "get")
      .mockReturnValue(false);

    try {
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      }, BOOTSTRAP_REVALIDATION_TIMEOUT_MS + 2_000);

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.bootstrapRecoveryReason).toBeNull();
      // The offline shortcut must not issue another revalidation after the
      // automatic retry re-runs the bootstrap effect.
      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
    } finally {
      onLineSpy.mockRestore();
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

  it("handles corrupted user data in localStorage", () => {
    localStorage.setItem("auth_user", "invalid-json");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
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

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expectNoStoredAuthState();
    await waitForSensitiveClientCleanup();
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

      act(() => {
        result.current.logout();
      });

      expect(clearSpy).toHaveBeenCalledWith({
        clearOfflineVaultTables: false,
      });
      expect(mockAnalyticsResetForLogout).toHaveBeenCalled();
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

  it("upgrades an in-flight non-sensitive auth clear when logout is requested", async () => {
    const storageClear = createDeferredPromise<void>();
    const restoreError = new Error("restore failed");
    const clearSpy = vi
      .spyOn(authStorage, "clear")
      .mockImplementation(() => storageClear.promise);
    const getUserSpy = vi
      .spyOn(authStorage, "getUser")
      .mockRejectedValue(restoreError);

    try {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(clearSpy).toHaveBeenCalledWith({
          clearOfflineVaultTables: true,
        });
      });

      expect(clearSensitiveClientState).not.toHaveBeenCalled();

      act(() => {
        result.current.logout();
      });

      storageClear.resolve();

      await waitForSensitiveClientCleanup();
    } finally {
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
          vaultProfileClear.promise as ReturnType<typeof db.vaultProfile.clear>
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
      expect(localStorage.getItem("auth_logout_barrier")).toBe("1");
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
      expect(localStorage.getItem("auth_logout_barrier")).toBe("1");
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

    act(() => {
      firstAuth.result.current.logout();
      secondAuth.result.current.logout();
    });

    await waitForSensitiveClientCleanup(2);

    expect(localStorage.getItem("auth_logout_skip_vault_table_cleanup")).toBe(
      "1"
    );

    await act(async () => {
      firstSensitiveCleanup.resolve();
      await Promise.resolve();
    });

    expect(localStorage.getItem("auth_logout_skip_vault_table_cleanup")).toBe(
      "1"
    );

    await act(async () => {
      secondSensitiveCleanup.resolve();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(localStorage.getItem("auth_logout_barrier")).toBe("1");
      expect(
        localStorage.getItem("auth_logout_skip_vault_table_cleanup")
      ).toBeNull();
    });
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
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem(AUTH_VAULT_STORAGE_KEY)).not.toBeNull();
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
    expect(syncOfflineSessionAccess).toHaveBeenCalledWith(true);
    expect(syncOfflineSessionAccess).not.toHaveBeenCalledWith(false);

    await act(async () => {
      await result.current.unlock?.();
    });

    expect(result.current.isVaultLocked).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(revalidatedUser);
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

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expectNoStoredAuthState();
    await waitForSensitiveClientCleanup();
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

  it("clears auth state when another tab removes auth storage", async () => {
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
      expect(result.current.isAuthenticated).toBe(false);
    });

    expect(result.current.user).toBeNull();
    await waitForSensitiveClientCleanup();
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
      expect(localStorage.getItem("auth_logout_barrier")).toBe("1");
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
      expect(localStorage.getItem("auth_logout_barrier")).toBe("1");
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
    expectNoStoredAuthState();
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
      expect(localStorage.getItem("auth_logout_barrier")).toBe("1");
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
      expect(result.current.isAuthenticated).toBe(false);
    });

    expect(result.current.user).toBeNull();
    await waitForSensitiveClientCleanup();
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
