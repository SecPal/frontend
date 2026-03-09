// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { AuthProvider } from "../contexts/AuthContext";
import { useAuth } from "./useAuth";
import { sessionEvents } from "../services/sessionEvents";
import { clearSensitiveClientState } from "../lib/clientStateCleanup";

vi.mock("../lib/clientStateCleanup", () => ({
  clearSensitiveClientState: vi.fn().mockResolvedValue(undefined),
}));

describe("useAuth", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
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
  });

  it("initializes with user from localStorage", () => {
    const mockUser = { id: 1, name: "Test User", email: "test@example.com" };

    localStorage.setItem("auth_user", JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.isAuthenticated).toBe(true);
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

  it("logout clears user", () => {
    const mockUser = { id: 1, name: "Test User", email: "test@example.com" };

    localStorage.setItem("auth_user", JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
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

  it("logs out when session:expired event is emitted", () => {
    const mockUser = { id: 1, name: "Test User", email: "test@example.com" };
    localStorage.setItem("auth_user", JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
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
