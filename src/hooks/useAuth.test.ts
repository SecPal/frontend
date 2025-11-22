// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { AuthProvider } from "../contexts/AuthContext";
import { useAuth } from "./useAuth";

describe("useAuth", () => {
  beforeEach(() => {
    localStorage.clear();
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
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("initializes with user from localStorage", () => {
    const mockUser = { id: 1, name: "Test User", email: "test@example.com" };
    const mockToken = "mock-token-123";

    localStorage.setItem("auth_token", mockToken);
    localStorage.setItem("auth_user", JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.token).toBe(mockToken);
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("handles corrupted user data in localStorage", () => {
    localStorage.setItem("auth_token", "mock-token");
    localStorage.setItem("auth_user", "invalid-json");

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBe("mock-token");
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("login stores token and user", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    const mockUser = { id: 1, name: "Test User", email: "test@example.com" };
    const mockToken = "new-token-456";

    act(() => {
      result.current.login(mockToken, mockUser);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.token).toBe(mockToken);
    expect(result.current.isAuthenticated).toBe(true);
    expect(localStorage.getItem("auth_token")).toBe(mockToken);
    expect(localStorage.getItem("auth_user")).toBe(JSON.stringify(mockUser));
  });

  it("logout clears token and user", () => {
    const mockUser = { id: 1, name: "Test User", email: "test@example.com" };
    const mockToken = "mock-token-123";

    localStorage.setItem("auth_token", mockToken);
    localStorage.setItem("auth_user", JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    act(() => {
      result.current.logout();
    });

    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem("auth_token")).toBeNull();
    expect(localStorage.getItem("auth_user")).toBeNull();
  });

  it("updates isAuthenticated when token changes", () => {
    const { result } = renderHook(() => useAuth(), {
      wrapper: AuthProvider,
    });

    expect(result.current.isAuthenticated).toBe(false);

    act(() => {
      result.current.login("token", { id: 1, name: "User", email: "u@e.com" });
    });

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.logout();
    });

    expect(result.current.isAuthenticated).toBe(false);
  });
});
