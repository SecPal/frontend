// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchCsrfToken,
  getCsrfTokenFromCookie,
  fetchWithCsrf,
  CsrfError,
} from "./csrf";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("csrf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear all cookies before each test
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchCsrfToken", () => {
    it("fetches CSRF token from /sanctum/csrf-cookie with credentials", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      await fetchCsrfToken();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/sanctum/csrf-cookie"),
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("throws CsrfError when CSRF endpoint fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      await expect(fetchCsrfToken()).rejects.toThrow(CsrfError);
      await expect(fetchCsrfToken()).rejects.toThrow(
        "Failed to fetch CSRF token"
      );
    });

    it("throws CsrfError on network error", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(fetchCsrfToken()).rejects.toThrow(CsrfError);
    });
  });

  describe("getCsrfTokenFromCookie", () => {
    it("returns CSRF token from XSRF-TOKEN cookie", () => {
      document.cookie = "XSRF-TOKEN=test-csrf-token-123";

      const token = getCsrfTokenFromCookie();

      expect(token).toBe("test-csrf-token-123");
    });

    it("returns null when XSRF-TOKEN cookie does not exist", () => {
      const token = getCsrfTokenFromCookie();

      expect(token).toBeNull();
    });

    it("decodes URL-encoded CSRF token", () => {
      document.cookie = "XSRF-TOKEN=test%2Bcsrf%3Dtoken";

      const token = getCsrfTokenFromCookie();

      expect(token).toBe("test+csrf=token");
    });

    it("handles multiple cookies and extracts XSRF-TOKEN", () => {
      document.cookie = "other_cookie=value1";
      document.cookie = "XSRF-TOKEN=my-token";
      document.cookie = "another_cookie=value2";

      const token = getCsrfTokenFromCookie();

      expect(token).toBe("my-token");
    });

    it("returns null when XSRF-TOKEN cookie is empty", () => {
      document.cookie = "XSRF-TOKEN=";

      const token = getCsrfTokenFromCookie();

      expect(token).toBeNull();
    });

    it("returns null for invalid token format (not Base64/URL-safe)", () => {
      document.cookie = "XSRF-TOKEN=invalid<>token!@#$%";

      const token = getCsrfTokenFromCookie();

      expect(token).toBeNull();
    });

    it("accepts valid Base64 token with special characters", () => {
      document.cookie = "XSRF-TOKEN=abc123+/=_-XYZ";

      const token = getCsrfTokenFromCookie();

      expect(token).toBe("abc123+/=_-XYZ");
    });
  });

  describe("fetchWithCsrf", () => {
    beforeEach(() => {
      document.cookie = "XSRF-TOKEN=test-csrf-token";
    });

    it("includes X-XSRF-TOKEN header in request", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      await fetchWithCsrf("http://api.example.com/test", {
        method: "POST",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "http://api.example.com/test",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );

      // Verify headers are set correctly
      const callArgs = mockFetch.mock.calls[0];
      if (callArgs) {
        const requestInit = callArgs[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.get("X-XSRF-TOKEN")).toBe("test-csrf-token");
      }
    });

    it("merges existing headers with X-XSRF-TOKEN", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await fetchWithCsrf("http://api.example.com/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );

      // Verify all headers are present
      const callArgs = mockFetch.mock.calls[0];
      if (callArgs) {
        const requestInit = callArgs[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.get("Content-Type")).toBe("application/json");
        expect(headers.get("Accept")).toBe("application/json");
        expect(headers.get("X-XSRF-TOKEN")).toBe("test-csrf-token");
      }
    });

    it("does not include X-XSRF-TOKEN header when token is not available", async () => {
      // Clear CSRF token cookie
      document.cookie =
        "XSRF-TOKEN=;expires=" + new Date().toUTCString() + ";path=/";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await fetchWithCsrf("http://api.example.com/test", {
        method: "POST",
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs).toBeDefined();
      if (callArgs) {
        const requestInit = callArgs[1] as RequestInit;
        expect(requestInit.headers).not.toHaveProperty("X-XSRF-TOKEN");
      }
    });

    it("retries request with fresh CSRF token on 419 response", async () => {
      // First call returns 419
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 419,
        statusText: "CSRF token mismatch",
      } as Response);

      // CSRF token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Update cookie with new token
      document.cookie = "XSRF-TOKEN=new-csrf-token";

      // Retry succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      const response = await fetchWithCsrf("http://api.example.com/test", {
        method: "POST",
      });

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify fetchCsrfToken was called
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/sanctum/csrf-cookie"),
        expect.objectContaining({
          credentials: "include",
        })
      );

      // Verify retry with new token
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        "http://api.example.com/test",
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );

      // Verify new CSRF token in headers
      const retryCallArgs = mockFetch.mock.calls[2];
      if (retryCallArgs) {
        const requestInit = retryCallArgs[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.get("X-XSRF-TOKEN")).toBe("new-csrf-token");
      }
    });

    it("throws CsrfError when retry fails after 419", async () => {
      // First call returns 419
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 419,
      } as Response);

      // CSRF token refresh fails
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      } as Response);

      await expect(
        fetchWithCsrf("http://api.example.com/test", {
          method: "POST",
        })
      ).rejects.toThrow(CsrfError);
    });

    it("returns response without retry for non-419 errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: "Bad Request",
      } as Response);

      const response = await fetchWithCsrf("http://api.example.com/test", {
        method: "POST",
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(400);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("preserves credentials: include in options", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await fetchWithCsrf("http://api.example.com/test", {
        method: "POST",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("emits session:expired event on 401 when online", async () => {
      // Mock navigator.onLine to return true
      const mockOnLine = vi
        .spyOn(navigator, "onLine", "get")
        .mockReturnValue(true);

      // Import sessionEvents to spy on it
      const { sessionEvents } = await import("./sessionEvents");
      const emitSpy = vi.spyOn(sessionEvents, "emit");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response);

      const response = await fetchWithCsrf("http://api.example.com/test", {
        method: "GET",
      });

      expect(response.status).toBe(401);
      expect(emitSpy).toHaveBeenCalledWith("session:expired");

      mockOnLine.mockRestore();
      emitSpy.mockRestore();
    });

    it("does not emit session:expired event on 401 when offline", async () => {
      // Mock navigator.onLine to return false
      const mockOnLine = vi
        .spyOn(navigator, "onLine", "get")
        .mockReturnValue(false);

      // Import sessionEvents to spy on it
      const { sessionEvents } = await import("./sessionEvents");
      const emitSpy = vi.spyOn(sessionEvents, "emit");

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response);

      const response = await fetchWithCsrf("http://api.example.com/test", {
        method: "GET",
      });

      expect(response.status).toBe(401);
      expect(emitSpy).not.toHaveBeenCalled();

      mockOnLine.mockRestore();
      emitSpy.mockRestore();
    });
  });

  describe("CsrfError", () => {
    it("creates error with message and status", () => {
      const error = new CsrfError("CSRF failed", 419);

      expect(error.message).toBe("CSRF failed");
      expect(error.status).toBe(419);
      expect(error.name).toBe("CsrfError");
    });

    it("creates error without status", () => {
      const error = new CsrfError("CSRF failed");

      expect(error.message).toBe("CSRF failed");
      expect(error.status).toBeUndefined();
    });
  });
});
