// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import {
  AuthProvider,
  BOOTSTRAP_REVALIDATION_TIMEOUT_MS,
} from "../contexts/AuthContext";
import { useAuth } from "./useAuth";
import { authStorage } from "../services/storage";
import { sessionEvents } from "../services/sessionEvents";
import { clearSensitiveClientState } from "../lib/clientStateCleanup";
import { syncOfflineSessionAccess } from "../lib/serviceWorkerSession";

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));

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

async function expectEncryptedStoredUser(
  expectedUser: Record<string, unknown>
): Promise<void> {
  const storedUser = localStorage.getItem("auth_user");

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
    vi.mocked(clearSensitiveClientState).mockResolvedValue(undefined);
    vi.mocked(syncOfflineSessionAccess).mockResolvedValue(undefined);
  });

  it("throws error when used outside AuthProvider", () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within an AuthProvider");
  });

  it("initializes with no user when localStorage is empty", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it("revalidates a stored user before completing bootstrap", async () => {
    const mockUser = {
      id: 1,
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const revalidatedUser = {
      ...mockUser,
      roles: ["Admin"],
    };
    const expectedRevalidatedUser = { ...revalidatedUser, id: "1" };
    const deferred = createDeferredPromise<typeof revalidatedUser>();

    localStorage.setItem("auth_user", JSON.stringify(mockUser));
    mockGetCurrentUser.mockReturnValueOnce(deferred.promise);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toEqual({ ...mockUser, id: "1" });
    expect(result.current.isAuthenticated).toBe(true);

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
      roles: ["Admin"],
    };
    const deferred = createDeferredPromise<typeof revalidatedUser>();

    localStorage.setItem("auth_user", JSON.stringify(mockUser));
    mockGetCurrentUser.mockReturnValueOnce(deferred.promise);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.isLoading).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();

    await act(async () => {
      deferred.resolve(revalidatedUser);
      await Promise.resolve();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(clearSensitiveClientState).toHaveBeenCalledTimes(1);
  });

  it("clears stale stored auth data when revalidation fails", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
    };

    localStorage.setItem("auth_user", JSON.stringify(mockUser));
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
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(clearSensitiveClientState).toHaveBeenCalledTimes(1);
  });

  it("keeps cached auth state when bootstrap revalidation fails for a transient error", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    localStorage.setItem("auth_user", JSON.stringify(mockUser));
    mockGetCurrentUser.mockRejectedValue(new Error("Network down"));

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
    expect(localStorage.getItem("auth_user")).toBe(JSON.stringify(mockUser));
    expect(clearSensitiveClientState).not.toHaveBeenCalled();
  });

  it("keeps cached auth state when Android bootstrap reports missing connectivity", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    localStorage.setItem("auth_user", JSON.stringify(mockUser));
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
    expect(localStorage.getItem("auth_user")).toBe(JSON.stringify(mockUser));
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
    localStorage.setItem("auth_user", JSON.stringify(mockUser));

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

  it("stops blocking protected routes when bootstrap revalidation exceeds the startup deadline", async () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };
    const deferred = createDeferredPromise<typeof mockUser>();

    vi.useFakeTimers();

    try {
      localStorage.setItem("auth_user", JSON.stringify(mockUser));
      mockGetCurrentUser.mockImplementation(() => deferred.promise);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      expect(result.current.isLoading).toBe(true);

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);

      await act(async () => {
        vi.advanceTimersByTime(BOOTSTRAP_REVALIDATION_TIMEOUT_MS);
        await Promise.resolve();
      });

      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.bootstrapRecoveryReason).toBe("timeout");
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps stored auth when offline without revalidation", () => {
    const mockUser = {
      id: "1",
      name: "Test User",
      email: "test@secpal.dev",
      emailVerified: false,
    };

    localStorage.setItem("auth_user", JSON.stringify(mockUser));

    const onLineSpy = vi
      .spyOn(window.navigator, "onLine", "get")
      .mockReturnValue(false);

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(mockGetCurrentUser).not.toHaveBeenCalled();

    onLineSpy.mockRestore();
  });

  it("handles corrupted user data in localStorage", () => {
    localStorage.setItem("auth_user", "invalid-json");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
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

    localStorage.setItem("auth_user", JSON.stringify(mockUser));

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
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(clearSensitiveClientState).toHaveBeenCalledTimes(1);
  });

  it("logout stores only the minimal logout barrier flag", async () => {
    const mockUser = { id: "1", name: "Test User", email: "test@secpal.dev" };

    localStorage.setItem("auth_user", JSON.stringify(mockUser));

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
    expect(localStorage.getItem("auth_logout_barrier")).toBe("1");
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
    localStorage.setItem("auth_user", JSON.stringify(mockUser));

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
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(clearSensitiveClientState).toHaveBeenCalledTimes(1);
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

    localStorage.setItem("auth_user", JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      localStorage.removeItem("auth_user");
      const crossTabLogoutEvent = new StorageEvent("storage", {
        key: "auth_user",
        oldValue: JSON.stringify(mockUser),
        newValue: null,
        storageArea: localStorage,
      });
      window.dispatchEvent(crossTabLogoutEvent);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(clearSensitiveClientState).toHaveBeenCalledTimes(1);
  });

  it("drops restored in-memory auth state when pageshow finds no stored user", async () => {
    const mockUser = { id: 1, name: "Test User", email: "test@secpal.dev" };

    localStorage.setItem("auth_user", JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      localStorage.removeItem("auth_user");
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

    localStorage.setItem("auth_user", JSON.stringify(mockUser));

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

    act(() => {
      localStorage.setItem("auth_user", JSON.stringify(mockUser));
      const staleAuthEvent = new StorageEvent("storage", {
        key: "auth_user",
        oldValue: null,
        newValue: JSON.stringify(mockUser),
        storageArea: localStorage,
      });
      window.dispatchEvent(staleAuthEvent);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("rejects BFCache-style auth restoration after explicit logout", async () => {
    const mockUser = { id: 1, name: "Test User", email: "test@secpal.dev" };

    localStorage.setItem("auth_user", JSON.stringify(mockUser));

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

    act(() => {
      localStorage.setItem("auth_user", JSON.stringify(mockUser));
      window.dispatchEvent(
        new PageTransitionEvent("pageshow", { persisted: true })
      );
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("does not bootstrap /v1/me when a logout barrier blocks stale auth storage", () => {
    const staleUser = { id: 1, name: "Stale User", email: "stale@secpal.dev" };

    localStorage.setItem("auth_user", JSON.stringify(staleUser));
    localStorage.setItem("auth_logout_barrier", "1");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.user).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(localStorage.getItem("auth_user")).toBeNull();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it("ignores storage events for keys other than auth_user", async () => {
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

    act(() => {
      localStorage.setItem("auth_user", JSON.stringify(newUser));
      const crossTabLoginEvent = new Event("storage");
      Object.defineProperties(crossTabLoginEvent, {
        key: { value: "auth_user" },
        oldValue: { value: null },
        newValue: { value: JSON.stringify(newUser) },
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

    localStorage.setItem("auth_user", JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });

    act(() => {
      // Write the corrupt value so localStorage matches the event (real browser
      // cross-tab writes keep newValue and the actual storage in sync).
      localStorage.setItem("auth_user", "{invalid json{{");
      const invalidJsonEvent = new StorageEvent("storage", {
        key: "auth_user",
        oldValue: JSON.stringify(mockUser),
        newValue: "{invalid json{{",
        storageArea: localStorage,
      });
      window.dispatchEvent(invalidJsonEvent);
    });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(false);
    });

    expect(result.current.user).toBeNull();
    expect(clearSensitiveClientState).toHaveBeenCalledTimes(1);
  });

  it("reconciles stored user state when pageshow fires and user is still in storage", async () => {
    // Use the same shape as the beforeEach bootstrap mock so that localStorage
    // stays consistent after the bootstrap revalidation overwrites it.
    const mockUser = {
      id: 1,
      name: "Bootstrap User",
      email: "bootstrap@secpal.dev",
    };

    localStorage.setItem("auth_user", JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    await waitFor(() => {
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
      expect(result.current.isAuthenticated).toBe(true);
    });

    expect(result.current.user).not.toBeNull();
    // The reconcile-path calls syncOfflineAuthState(true) which forwards to syncOfflineSessionAccess.
    expect(syncOfflineSessionAccess).toHaveBeenCalledWith(true);
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
