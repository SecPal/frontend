// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { login, logout, logoutAll, AuthApiError } from "./authApi";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

  describe("login", () => {
    it("sends POST request to /v1/auth/token with credentials", async () => {
      const mockResponse = {
        user: { id: 1, name: "Test User", email: "test@example.com" },
      };

      // Mock CSRF token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock login request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await login({
        email: "test@example.com",
        password: "password123",
      });

      // Verify CSRF token was fetched
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("/sanctum/csrf-cookie"),
        expect.objectContaining({
          credentials: "include",
        })
      );

      // Verify login request
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/v1/auth/token"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            email: "test@example.com",
            password: "password123",
            device_name: "secpal-frontend",
          }),
        })
      );

      // Verify headers separately (Headers object)
      const loginCallArgs = mockFetch.mock.calls[1];
      expect(loginCallArgs).toBeDefined();
      if (loginCallArgs) {
        const requestInit = loginCallArgs[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.get("Content-Type")).toBe("application/json");
        expect(headers.get("Accept")).toBe("application/json");
        expect(headers.get("X-XSRF-TOKEN")).toBe("test-csrf-token");
      }

      expect(result).toEqual(mockResponse);
    });

    it("uses custom device_name when provided", async () => {
      const mockResponse = {
        user: { id: 1, name: "Test", email: "test@example.com" },
      };

      // Mock CSRF token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock login request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      await login({
        email: "test@example.com",
        password: "password123",
        device_name: "custom-device",
      });

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.any(String),
        expect.objectContaining({
          body: expect.stringContaining("custom-device"),
        })
      );
    });

    it("throws AuthApiError on failed login", async () => {
      const errorResponse = {
        message: "Invalid credentials",
        errors: { email: ["The provided credentials are incorrect."] },
      };

      // Mock CSRF token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock failed login
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => errorResponse,
      } as Response);

      await expect(
        login({ email: "wrong@example.com", password: "wrong" })
      ).rejects.toThrow(AuthApiError);

      // Second call with fresh mock
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => errorResponse,
      } as Response);

      try {
        await login({ email: "wrong@example.com", password: "wrong" });
      } catch (error) {
        expect(error).toBeInstanceOf(AuthApiError);
        expect((error as AuthApiError).message).toBe("Invalid credentials");
        expect((error as AuthApiError).errors).toEqual(errorResponse.errors);
      }
    });

    it("uses default error message when none provided", async () => {
      // Mock CSRF token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock failed login with empty error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({}),
      } as Response);

      await expect(
        login({ email: "test@example.com", password: "test" })
      ).rejects.toThrow("Login failed");
    });

    it("handles non-JSON error responses gracefully", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Mock CSRF token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock failed login with non-JSON response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => {
          throw new Error("Unexpected token < in JSON");
        },
      } as Partial<Response> as Response);

      await expect(
        login({ email: "test@example.com", password: "test" })
      ).rejects.toThrow("Login failed: 500 Internal Server Error");

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Login failed - non-JSON response:",
        500,
        "Internal Server Error"
      );

      consoleErrorSpy.mockRestore();
    });

    it("logs API error details on JSON error response", async () => {
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const errorResponse = {
        message: "Validation failed",
        errors: { email: ["Email is required"] },
      };

      // Mock CSRF token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      // Mock failed login with JSON error
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => errorResponse,
      } as Response);

      try {
        await login({ email: "", password: "test" });
      } catch {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          "Login API error:",
          errorResponse
        );
      }

      consoleErrorSpy.mockRestore();
    });
  });

  describe("logout", () => {
    it("sends POST request to /v1/auth/logout with credentials", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await logout();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/auth/logout"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );

      // Verify headers separately (Headers object)
      const logoutCallArgs = mockFetch.mock.calls[0];
      expect(logoutCallArgs).toBeDefined();
      if (logoutCallArgs) {
        const requestInit = logoutCallArgs[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.get("Accept")).toBe("application/json");
        expect(headers.get("X-XSRF-TOKEN")).toBe("test-csrf-token");
      }
    });

    it("throws AuthApiError on failed logout", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      } as Response);

      await expect(logout()).rejects.toThrow(AuthApiError);
    });

    it("throws AuthApiError with fallback message on non-JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("Not JSON");
        },
      } as Partial<Response> as Response);

      await expect(logout()).rejects.toThrow("Logout failed");
    });
  });

  describe("logoutAll", () => {
    it("sends POST request to /v1/auth/logout-all with credentials", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await logoutAll();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/auth/logout-all"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );

      // Verify headers separately (Headers object)
      const logoutAllCallArgs = mockFetch.mock.calls[0];
      expect(logoutAllCallArgs).toBeDefined();
      if (logoutAllCallArgs) {
        const requestInit = logoutAllCallArgs[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.get("Accept")).toBe("application/json");
        expect(headers.get("X-XSRF-TOKEN")).toBe("test-csrf-token");
      }
    });

    it("throws AuthApiError on failed logoutAll", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      } as Response);

      await expect(logoutAll()).rejects.toThrow(AuthApiError);
    });

    it("throws AuthApiError with fallback message on non-JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error("Not JSON");
        },
      } as Partial<Response> as Response);

      await expect(logoutAll()).rejects.toThrow("Logout all devices failed");
    });
  });

  describe("AuthApiError", () => {
    it("creates error with message and errors", () => {
      const errors = { email: ["Invalid email"] };
      const error = new AuthApiError("Test error", errors);

      expect(error.message).toBe("Test error");
      expect(error.errors).toEqual(errors);
      expect(error.name).toBe("AuthApiError");
    });

    it("creates error without errors object", () => {
      const error = new AuthApiError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.errors).toBeUndefined();
    });
  });
});
