// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { login, logout, logoutAll, AuthApiError } from "./authApi";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("login", () => {
    it("sends POST request to /v1/auth/token", async () => {
      const mockResponse = {
        token: "test-token-123",
        user: { id: 1, name: "Test User", email: "test@example.com" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await login({
        email: "test@example.com",
        password: "password123",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/auth/token"),
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            email: "test@example.com",
            password: "password123",
            device_name: "secpal-frontend",
          }),
        })
      );

      expect(result).toEqual(mockResponse);
    });

    it("uses custom device_name when provided", async () => {
      const mockResponse = {
        token: "test-token",
        user: { id: 1, name: "Test", email: "test@example.com" },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await login({
        email: "test@example.com",
        password: "password123",
        device_name: "custom-device",
      });

      expect(mockFetch).toHaveBeenCalledWith(
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

      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => errorResponse,
      } as Response);

      await expect(
        login({ email: "wrong@example.com", password: "wrong" })
      ).rejects.toThrow(AuthApiError);

      try {
        await login({ email: "wrong@example.com", password: "wrong" });
      } catch (error) {
        expect(error).toBeInstanceOf(AuthApiError);
        expect((error as AuthApiError).message).toBe("Invalid credentials");
        expect((error as AuthApiError).errors).toEqual(errorResponse.errors);
      }
    });

    it("uses default error message when none provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response);

      await expect(
        login({ email: "test@example.com", password: "test" })
      ).rejects.toThrow("Login failed");
    });
  });

  describe("logout", () => {
    it("sends POST request to /v1/auth/logout with token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      await logout("test-token-123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/auth/logout"),
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer test-token-123",
            Accept: "application/json",
          },
        })
      );
    });

    it("does not throw on failed logout", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      } as Response);

      await expect(logout("invalid-token")).resolves.toBeUndefined();
    });
  });

  describe("logoutAll", () => {
    it("sends POST request to /v1/auth/logout-all with token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      await logoutAll("test-token-123");

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/auth/logout-all"),
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "Bearer test-token-123",
            Accept: "application/json",
          },
        })
      );
    });

    it("does not throw on failed logoutAll", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
      } as Response);

      await expect(logoutAll("invalid-token")).resolves.toBeUndefined();
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
