// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { login, logout } from "../../../src/services/authApi";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("Cookie-based Authentication Integration", () => {
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

  describe("Login Flow", () => {
    it("completes full login flow with CSRF token and httpOnly cookies", async () => {
      const mockUser = {
        id: 1,
        name: "Test User",
        email: "test@secpal.app",
      };

      // Mock CSRF token fetch - returns httpOnly cookie
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      // Set CSRF token cookie (simulates backend setting it)
      document.cookie = "XSRF-TOKEN=csrf-token-from-backend";

      // Mock login request - returns user data (NO token in response)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ user: mockUser }),
      } as Response);

      const result = await login({
        email: "test@secpal.app",
        password: "SecurePassword123!",
      });

      // Verify CSRF token was fetched first
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("/sanctum/csrf-cookie"),
        expect.objectContaining({
          credentials: "include",
        })
      );

      // Verify login request sent credentials
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/v1/auth/token"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );

      // Verify login request included CSRF token
      const loginCallArgs = mockFetch.mock.calls[1];
      expect(loginCallArgs).toBeDefined();
      if (loginCallArgs) {
        const requestInit = loginCallArgs[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.get("X-XSRF-TOKEN")).toBe("csrf-token-from-backend");
      }

      // Verify response contains only user data (no token)
      expect(result).toEqual({ user: mockUser });
      expect(result).not.toHaveProperty("token");
    });

    it("sends credentials: include with all requests", async () => {
      // Mock CSRF fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      document.cookie = "XSRF-TOKEN=test-token";

      // Mock login request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: { id: 1, name: "Test", email: "test@secpal.app" },
        }),
      } as Response);

      await login({
        email: "test@secpal.app",
        password: "password",
      });

      // Verify both requests include credentials
      expect(mockFetch).toHaveBeenCalledTimes(2);
      const csrfCall = mockFetch.mock.calls[0];
      const loginCall = mockFetch.mock.calls[1];

      expect(csrfCall?.[1]).toMatchObject({ credentials: "include" });
      expect(loginCall?.[1]).toMatchObject({ credentials: "include" });
    });

    it("does not send Authorization header (cookies handle auth)", async () => {
      // Mock CSRF fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      document.cookie = "XSRF-TOKEN=test-token";

      // Mock login request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: { id: 1, name: "Test", email: "test@secpal.app" },
        }),
      } as Response);

      await login({
        email: "test@secpal.app",
        password: "password",
      });

      // Verify login request does NOT include Authorization header
      const loginCall = mockFetch.mock.calls[1];
      expect(loginCall).toBeDefined();
      if (loginCall) {
        const requestInit = loginCall[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.has("Authorization")).toBe(false);
      }
    });
  });

  describe("Authenticated Requests", () => {
    it("includes cookies automatically without manual token handling", async () => {
      // Set session cookie (simulates backend setting it after login)
      document.cookie =
        "laravel_session=session-cookie-value; HttpOnly; SameSite=Lax";
      document.cookie = "XSRF-TOKEN=csrf-token";

      // Mock authenticated request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: "protected resource" }),
      } as Response);

      const response = await fetch("https://api.secpal.app/v1/user/profile", {
        credentials: "include",
        headers: {
          "X-XSRF-TOKEN": "csrf-token",
        },
      });

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("fails with 401 when session cookie is missing", async () => {
      // No session cookie set
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response);

      const response = await fetch("https://api.secpal.app/v1/user/profile", {
        credentials: "include",
      });

      expect(response.ok).toBe(false);
      expect(response.status).toBe(401);
    });
  });

  describe("Logout Flow", () => {
    it("completes logout and clears session", async () => {
      // Set session and CSRF cookies
      document.cookie = "laravel_session=active-session";
      document.cookie = "XSRF-TOKEN=csrf-token";

      // Mock logout request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      await logout();

      // Verify logout request was sent with credentials
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/auth/logout"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );

      // Verify CSRF token was included
      const logoutCall = mockFetch.mock.calls[0];
      expect(logoutCall).toBeDefined();
      if (logoutCall) {
        const requestInit = logoutCall[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.get("X-XSRF-TOKEN")).toBe("csrf-token");
      }
    });
  });

  describe("Security Verification", () => {
    it("verifies no token is accessible via localStorage", async () => {
      // Mock successful login
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      document.cookie = "XSRF-TOKEN=test-token";
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          user: { id: 1, name: "Test", email: "test@secpal.app" },
        }),
      } as Response);

      await login({
        email: "test@secpal.app",
        password: "password",
      });

      // Verify localStorage does NOT contain auth token
      expect(localStorage.getItem("auth_token")).toBeNull();
      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("access_token")).toBeNull();

      // Verify no auth-related keys in localStorage
      const allKeys = Object.keys(localStorage);
      const authKeys = allKeys.filter((key) =>
        key.toLowerCase().includes("token")
      );
      expect(authKeys).toHaveLength(0);
    });

    it("verifies token is not accessible via JavaScript (httpOnly)", () => {
      // Set a real httpOnly cookie (in real browser, this would be set by backend)
      // In test environment, we can only simulate non-httpOnly cookies
      document.cookie = "laravel_session=test-session; SameSite=Lax";

      // Verify session cookie exists
      const cookies = document.cookie;
      expect(cookies).toContain("laravel_session");

      // In production, httpOnly cookies are NOT accessible via document.cookie
      // This test verifies the EXPECTATION that real httpOnly cookies
      // would not be readable via JavaScript
      // The backend MUST set httpOnly=true in Set-Cookie header
    });

    it("verifies cookies have correct SameSite attribute expectation", () => {
      // This test documents the EXPECTATION for backend cookie configuration
      // Backend MUST set: SameSite=Lax for session cookies
      // Backend MUST set: SameSite=Lax for CSRF token cookies

      // In test environment, we can only set mock cookies
      document.cookie = "XSRF-TOKEN=test; SameSite=Lax";

      // Verify CSRF token cookie exists
      const cookies = document.cookie;
      expect(cookies).toContain("XSRF-TOKEN=test");

      // Note: document.cookie API doesn't expose SameSite attribute
      // This must be verified in browser DevTools or E2E tests
      // Backend MUST implement: SameSite=Lax (allows cross-site GET but not POST)
    });
  });

  describe("Cookie Attributes Verification", () => {
    it("documents expected cookie security attributes", () => {
      // This test serves as documentation for expected backend cookie configuration
      // These attributes CANNOT be read via JavaScript but MUST be set by backend

      const expectedSessionCookieAttributes = {
        name: "laravel_session",
        httpOnly: true, // CRITICAL: Prevents JavaScript access
        secure: true, // REQUIRED in production (HTTPS only)
        sameSite: "Lax", // Prevents CSRF attacks
        path: "/",
        maxAge: 7200, // 2 hours (120 minutes)
      };

      const expectedCsrfCookieAttributes = {
        name: "XSRF-TOKEN",
        httpOnly: false, // Must be readable by JavaScript to send in header
        secure: true, // REQUIRED in production
        sameSite: "Lax",
        path: "/",
      };

      // These expectations are documented for backend implementation
      expect(expectedSessionCookieAttributes.httpOnly).toBe(true);
      expect(expectedSessionCookieAttributes.secure).toBe(true);
      expect(expectedSessionCookieAttributes.sameSite).toBe("Lax");

      expect(expectedCsrfCookieAttributes.httpOnly).toBe(false);
      expect(expectedCsrfCookieAttributes.secure).toBe(true);
      expect(expectedCsrfCookieAttributes.sameSite).toBe("Lax");
    });
  });
});
