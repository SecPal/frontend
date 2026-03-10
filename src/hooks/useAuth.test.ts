// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { AuthProvider } from "../contexts/AuthContext";
import { useAuth } from "./useAuth";
import { sessionEvents } from "../services/sessionEvents";
import { clearSensitiveClientState } from "../lib/clientStateCleanup";

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

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

describe("useAuth", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    sessionEvents.reset();
    mockGetCurrentUser.mockResolvedValue({
      id: 1,
      name: "Bootstrap User",
      email: "bootstrap@example.com",
    });
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
    const mockUser = { id: 1, name: "Test User", email: "test@example.com" };
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

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);

    deferred.resolve(revalidatedUser);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(revalidatedUser);
    expect(localStorage.getItem("auth_user")).toBe(
      JSON.stringify(revalidatedUser)
    );
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  it("clears stale stored auth data when revalidation fails", async () => {
    const mockUser = { id: 1, name: "Test User", email: "test@example.com" };

    localStorage.setItem("auth_user", JSON.stringify(mockUser));
    mockGetCurrentUser.mockRejectedValueOnce(new Error("Unauthorized"));

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

  it("keeps stored auth when offline without revalidation", () => {
    const mockUser = { id: 1, name: "Test User", email: "test@example.com" };

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

  it("login stores user", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    const mockUser = { id: 1, name: "Test User", email: "test@example.com" };

    act(() => {
      result.current.login(mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem("auth_user")).toBe(JSON.stringify(mockUser));
  });

  it("logout clears user", async () => {
    const mockUser = { id: 1, name: "Test User", email: "test@example.com" };

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

  it("updates isAuthenticated when user changes", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      result.current.login({ id: 1, name: "User", email: "u@e.com" });
    });

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
  });

  it("logs out when session:expired event is emitted", async () => {
    const mockUser = { id: 1, name: "Test User", email: "test@example.com" };
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
});
