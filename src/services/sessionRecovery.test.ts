// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  tryRecoverSession,
  createAuthAwareFetch,
  SessionExpiredError,
} from "./sessionRecovery";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Mock navigator.onLine
const mockOnLine = vi.fn(() => true);
Object.defineProperty(navigator, "onLine", {
  get: mockOnLine,
  configurable: true,
});

describe("sessionRecovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOnLine.mockReturnValue(true);
    // Clear cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    // Set CSRF token cookie for tests
    document.cookie = "XSRF-TOKEN=test-csrf-token";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("tryRecoverSession", () => {
    it("returns user data when /me endpoint succeeds", async () => {
      const mockUser = { id: 1, name: "Test User", email: "test@example.com" };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUser,
      } as Response);

      const result = await tryRecoverSession();

      expect(result).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/me"),
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("returns null when session is invalid (401)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      } as Response);

      const result = await tryRecoverSession();

      expect(result).toBeNull();
    });

    it("returns null when offline", async () => {
      mockOnLine.mockReturnValue(false);

      const result = await tryRecoverSession();

      expect(result).toBeNull();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("returns null on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const result = await tryRecoverSession();

      expect(result).toBeNull();
    });
  });

  describe("createAuthAwareFetch", () => {
    it("returns response directly on success", async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: async () => ({ data: "test" }),
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const onSessionExpired = vi.fn();
      const authFetch = createAuthAwareFetch(onSessionExpired);

      const result = await authFetch("http://api.example.com/test");

      expect(result).toBe(mockResponse);
      expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it("calls onSessionExpired and throws on 401 when online", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response);

      const onSessionExpired = vi.fn();
      const authFetch = createAuthAwareFetch(onSessionExpired);

      await expect(authFetch("http://api.example.com/test")).rejects.toThrow(
        SessionExpiredError
      );

      expect(onSessionExpired).toHaveBeenCalled();
    });

    it("returns 401 response without triggering session expired when offline", async () => {
      mockOnLine.mockReturnValue(false);

      const mockResponse = {
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const onSessionExpired = vi.fn();
      const authFetch = createAuthAwareFetch(onSessionExpired);

      const result = await authFetch("http://api.example.com/test");

      // When offline, return the response without triggering session expired
      // The app should use cached data
      expect(result).toBe(mockResponse);
      expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it("returns non-401 error responses normally", async () => {
      const mockResponse = {
        ok: false,
        status: 403,
        statusText: "Forbidden",
      } as Response;

      mockFetch.mockResolvedValueOnce(mockResponse);

      const onSessionExpired = vi.fn();
      const authFetch = createAuthAwareFetch(onSessionExpired);

      const result = await authFetch("http://api.example.com/test");

      expect(result.status).toBe(403);
      expect(onSessionExpired).not.toHaveBeenCalled();
    });

    it("passes through fetch options correctly", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      const authFetch = createAuthAwareFetch(vi.fn());

      await authFetch("http://api.example.com/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: "test" }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://api.example.com/test",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data: "test" }),
        })
      );
    });
  });

  describe("SessionExpiredError", () => {
    it("creates error with correct name and message", () => {
      const error = new SessionExpiredError();

      expect(error.name).toBe("SessionExpiredError");
      expect(error.message).toBe("Session has expired");
    });

    it("creates error with custom message", () => {
      const error = new SessionExpiredError("Custom message");

      expect(error.message).toBe("Custom message");
    });
  });
});
