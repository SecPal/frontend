// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  startPasskeyAuthenticationChallenge,
  verifyPasskeyAuthenticationChallenge,
  deletePasskey,
  startPasskeyRegistrationChallenge,
  verifyPasskeyRegistrationChallenge,
  getPasskeys,
  login,
  logout,
  logoutAll,
  getCurrentUser,
  sendVerificationNotification,
  getMfaStatus,
  startTotpEnrollment,
  confirmTotpEnrollment,
  regenerateRecoveryCodes,
  disableMfa,
  AuthApiError,
  verifyMfaChallenge,
} from "./authApi";

const mockFetch = vi.fn();

const createAuthenticatedUser = (overrides?: Record<string, unknown>) => ({
  id: 1,
  name: "Test User",
  email: "test@secpal.dev",
  emailVerified: true,
  roles: [],
  permissions: [],
  hasOrganizationalScopes: false,
  hasCustomerAccess: false,
  hasSiteAccess: false,
  ...overrides,
});

describe("authApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
    // Clear cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });
    // Set CSRF token cookie for tests
    document.cookie = "XSRF-TOKEN=test-csrf-token";
  });

  describe("login", () => {
    it("sends POST request to /v1/auth/login with credentials", async () => {
      const mockResponse = {
        user: createAuthenticatedUser(),
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
        email: "test@secpal.dev",
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

      // Verify login request (SPA uses /v1/auth/login, not /v1/auth/token)
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/v1/auth/login"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            email: "test@secpal.dev",
            password: "password123",
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

    it("returns user with authorization data when provided", async () => {
      const mockResponse = {
        user: {
          id: 1,
          name: "Test User",
          email: "test@secpal.dev",
          roles: ["Admin"],
          permissions: ["users.read", "customers.*"],
          hasOrganizationalScopes: true,
          hasCustomerAccess: true,
          hasSiteAccess: true,
        },
      };

      // Mock CSRF token fetch
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);

      // Mock login request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await login({
        email: "test@secpal.dev",
        password: "password123",
      });

      expect("user" in result).toBe(true);
      if ("user" in result) {
        expect(result.user.roles).toEqual(["Admin"]);
        expect(result.user.permissions).toEqual(["users.read", "customers.*"]);
        expect(result.user.hasOrganizationalScopes).toBe(true);
        expect(result.user.hasCustomerAccess).toBe(true);
        expect(result.user.hasSiteAccess).toBe(true);
      }
    });

    it("returns an MFA challenge when the backend requires a second factor", async () => {
      const mockResponse = {
        challenge: {
          id: "550e8400-e29b-41d4-a716-446655440099",
          purpose: "login",
          login_context: "session",
          primary_method: "totp",
          available_methods: ["totp", "recovery_code"],
          expires_at: "2026-04-01T09:30:00Z",
        },
      };

      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => mockResponse,
      } as Response);

      await expect(
        login({ email: "test@secpal.dev", password: "password123" })
      ).resolves.toEqual(mockResponse);
    });

    it("sends login request with email and password only (no device_name for SPA)", async () => {
      const mockResponse = {
        user: createAuthenticatedUser({ name: "Test" }),
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
        email: "test@secpal.dev",
        password: "password123",
      });

      // SPA login does not send device_name (that's for token-based auth)
      const loginCall = mockFetch.mock.calls[1];
      expect(loginCall).toBeDefined();
      if (loginCall) {
        const requestInit = loginCall[1] as RequestInit;
        const body = JSON.parse(requestInit.body as string);
        expect(body).toEqual({
          email: "test@secpal.dev",
          password: "password123",
        });
        expect(body).not.toHaveProperty("device_name");
      }
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
        login({ email: "wrong@secpal.dev", password: "wrong" })
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
        await login({ email: "wrong@secpal.dev", password: "wrong" });
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
        login({ email: "test@secpal.dev", password: "test" })
      ).rejects.toThrow("Login failed");
    });

    it("handles non-JSON error responses gracefully", async () => {
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
        login({ email: "test@secpal.dev", password: "test" })
      ).rejects.toThrow("Login failed: 500 Internal Server Error");
    });

    it("throws AuthApiError with error details on JSON error response", async () => {
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
        expect.fail("Expected login to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthApiError);
        expect((error as AuthApiError).message).toBe("Validation failed");
        expect((error as AuthApiError).errors).toEqual({
          email: ["Email is required"],
        });
      }
    });

    it("captures retry-after metadata on 429 login errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          "Content-Type": "application/json",
          "Retry-After": "120",
        }),
        json: async () => ({
          message: "Too many login attempts. Please try again later.",
        }),
      } as Response);

      await expect(
        login({ email: "test@secpal.dev", password: "wrong" })
      ).rejects.toMatchObject({
        message: "Too many login attempts. Please try again later.",
        status: 429,
        retryAfterSeconds: 120,
      });
    });

    it("treats Retry-After: 0 as valid (retry immediately) on 429 login errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
      } as Response);

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Headers({
          "Content-Type": "application/json",
          "Retry-After": "0",
        }),
        json: async () => ({
          message: "Too many login attempts. Please try again later.",
        }),
      } as Response);

      await expect(
        login({ email: "test@secpal.dev", password: "wrong" })
      ).rejects.toMatchObject({
        message: "Too many login attempts. Please try again later.",
        status: 429,
        retryAfterSeconds: 0,
      });
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
          cache: "no-store",
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
          cache: "no-store",
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

  describe("getCurrentUser", () => {
    it("sends GET request to /v1/me with credentials", async () => {
      const mockUser = {
        id: 1,
        name: "Test User",
        email: "test@secpal.dev",
        roles: ["Admin"],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockUser,
      } as Response);

      const result = await getCurrentUser();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/me"),
        expect.objectContaining({
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })
      );

      const currentUserCallArgs = mockFetch.mock.calls[0];
      expect(currentUserCallArgs).toBeDefined();
      if (currentUserCallArgs) {
        const requestInit = currentUserCallArgs[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.get("Accept")).toBe("application/json");
      }

      expect(result).toEqual(mockUser);
    });

    it("throws AuthApiError on failed current-user fetch", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ message: "Unauthorized" }),
      } as Response);

      await expect(getCurrentUser()).rejects.toThrow(AuthApiError);
    });

    it("throws AuthApiError with fallback message on non-JSON response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: async () => {
          throw new Error("Not JSON");
        },
      } as Partial<Response> as Response);

      await expect(getCurrentUser()).rejects.toThrow(
        "Current user fetch failed: 500 Internal Server Error"
      );
    });

    it("wraps network failures in AuthApiError", async () => {
      mockFetch.mockRejectedValue(new Error("Network down"));

      await expect(getCurrentUser()).rejects.toThrow(
        "Current user fetch failed: Network down"
      );
      await expect(getCurrentUser()).rejects.toBeInstanceOf(AuthApiError);
    });

    it("fails fast when the current-user endpoint returns HTML instead of JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Headers({
          "Content-Type": "text/html; charset=utf-8",
        }),
      } as Partial<Response> as Response);

      const currentUserPromise = getCurrentUser();

      await expect(currentUserPromise).rejects.toThrow(
        "Current user fetch failed: expected application/json response from API"
      );
      await expect(currentUserPromise).rejects.toBeInstanceOf(AuthApiError);
    });
  });

  describe("sendVerificationNotification", () => {
    it("posts to the verification notification endpoint and returns the API message", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        json: async () => ({ message: "Verification link sent successfully." }),
      } as Response);

      await expect(sendVerificationNotification()).resolves.toEqual({
        message: "Verification link sent successfully.",
      });

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/v1/auth/email/verification-notification"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          cache: "no-store",
        })
      );
    });

    it("surfaces JSON verification-notification errors with status metadata", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        json: async () => ({
          message: "Too many requests.",
          code: "TOO_MANY_REQUESTS",
        }),
      } as Response);

      await expect(sendVerificationNotification()).rejects.toMatchObject({
        message: "Too many requests.",
        status: 429,
        code: "TOO_MANY_REQUESTS",
      });
    });
  });

  describe("verifyMfaChallenge", () => {
    it("posts the verification code to the MFA challenge endpoint", async () => {
      const mockResponse = {
        user: createAuthenticatedUser(),
        authentication: {
          mode: "session",
          mfa_completed: true,
        },
      };

      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await verifyMfaChallenge(
        "550e8400-e29b-41d4-a716-446655440099",
        {
          method: "totp",
          code: "123456",
        }
      );

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          "/v1/auth/mfa-challenges/550e8400-e29b-41d4-a716-446655440099/verify"
        ),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({
            method: "totp",
            code: "123456",
          }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it("surfaces JSON verification errors with status metadata", async () => {
      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          message: "The login challenge has expired.",
          code: "CONFLICT",
        }),
      } as Response);

      try {
        await verifyMfaChallenge("550e8400-e29b-41d4-a716-446655440099", {
          method: "totp",
          code: "123456",
        });
        expect.fail("Expected verifyMfaChallenge to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthApiError);
        expect((error as AuthApiError).status).toBe(409);
        expect((error as AuthApiError).code).toBe("CONFLICT");
      }
    });
  });

  describe("passkey authentication", () => {
    it("starts a browser passkey authentication challenge", async () => {
      const mockResponse = {
        data: {
          challenge_id: "550e8400-e29b-41d4-a716-446655440099",
          public_key: {
            challenge: "Zm9vYmFy",
            rp_id: "app.secpal.dev",
            timeout: 60000,
            user_verification: "preferred",
          },
          mediation: "conditional",
          expires_at: "2026-04-06T12:00:00Z",
        },
      };

      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      } as Response);

      await expect(startPasskeyAuthenticationChallenge()).resolves.toEqual(
        mockResponse
      );

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/v1/auth/passkeys/challenges"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          cache: "no-store",
        })
      );
    });

    it("starts an email-scoped browser passkey authentication challenge", async () => {
      const mockResponse = {
        data: {
          challenge_id: "550e8400-e29b-41d4-a716-446655440099",
          public_key: {
            challenge: "Zm9vYmFy",
            rp_id: "app.secpal.dev",
            timeout: 60000,
            user_verification: "preferred",
            allow_credentials: [
              {
                id: "credential-id",
                type: "public-key",
              },
            ],
          },
          mediation: "optional",
          expires_at: "2026-04-06T12:00:00Z",
        },
      };

      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      } as Response);

      await expect(
        startPasskeyAuthenticationChallenge({ email: "test@secpal.dev" })
      ).resolves.toEqual(mockResponse);

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/v1/auth/passkeys/challenges"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ email: "test@secpal.dev" }),
        })
      );
    });

    it("verifies a browser passkey authentication challenge", async () => {
      const mockResponse = {
        user: createAuthenticatedUser(),
        authentication: {
          mode: "session",
          method: "passkey",
          mfa_completed: true,
        },
      };

      const payload = {
        credential: {
          id: "credential-id",
          raw_id: "credential-id",
          type: "public-key" as const,
          response: {
            client_data_json: "Y2xpZW50",
            authenticator_data: "YXV0aA",
            signature: "c2lnbmF0dXJl",
          },
          client_extension_results: {},
        },
      };

      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      await expect(
        verifyPasskeyAuthenticationChallenge(
          "550e8400-e29b-41d4-a716-446655440099",
          payload
        )
      ).resolves.toEqual(mockResponse);

      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining(
          "/v1/auth/passkeys/challenges/550e8400-e29b-41d4-a716-446655440099/verify"
        ),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify(payload),
        })
      );
    });
  });

  describe("getMfaStatus", () => {
    it("fetches MFA status from /v1/me/mfa", async () => {
      const mockResponse = {
        data: {
          enabled: true,
          method: "totp",
          recovery_codes_remaining: 8,
          recovery_codes_generated_at: "2026-04-01T09:12:00Z",
          enrolled_at: "2026-04-01T09:10:00Z",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      await expect(getMfaStatus()).resolves.toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/me/mfa"),
        expect.objectContaining({
          method: "GET",
          credentials: "include",
          cache: "no-store",
        })
      );
    });
  });

  describe("getPasskeys", () => {
    it("fetches enrolled passkeys from /v1/me/passkeys", async () => {
      const mockResponse = {
        data: [
          {
            id: "credential-id",
            label: "Work MacBook Touch ID",
            created_at: "2026-04-06T09:12:00Z",
            last_used_at: null,
            transports: ["internal"],
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      await expect(getPasskeys()).resolves.toEqual(mockResponse);
    });
  });

  describe("passkey registration", () => {
    it("starts a passkey registration challenge", async () => {
      const mockResponse = {
        data: {
          challenge_id: "550e8400-e29b-41d4-a716-446655440099",
          public_key: {
            challenge: "Zm9vYmFy",
            rp: {
              id: "app.secpal.dev",
              name: "SecPal",
            },
            user: {
              id: "dXNlci1pZA",
              name: "test@secpal.dev",
              display_name: "Test User",
            },
            pub_key_cred_params: [{ type: "public-key", alg: -7 }],
          },
        },
      };

      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      } as Response);

      await expect(startPasskeyRegistrationChallenge()).resolves.toEqual(
        mockResponse
      );

      expect(mockFetch.mock.calls[1]?.[0]).toEqual(
        expect.stringContaining("/v1/me/passkeys/challenges/registration")
      );
      expect(mockFetch.mock.calls[1]?.[1]).toMatchObject({
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
    });

    it("verifies a passkey registration challenge", async () => {
      const payload = {
        label: "Work MacBook Touch ID",
        credential: {
          id: "credential-id",
          raw_id: "credential-raw-id",
          type: "public-key" as const,
          response: {
            client_data_json: "Y2xpZW50",
            attestation_object: "YXR0ZXN0YXRpb24",
            transports: ["internal" as const],
          },
          client_extension_results: {},
        },
      };
      const mockResponse = {
        data: {
          credential: {
            id: "credential-id",
            label: "Work MacBook Touch ID",
            created_at: "2026-04-06T09:12:00Z",
            last_used_at: null,
            transports: ["internal"],
          },
          total_passkeys: 1,
        },
      };

      mockFetch.mockResolvedValueOnce({ ok: true } as Response);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      } as Response);

      await expect(
        verifyPasskeyRegistrationChallenge(
          "550e8400-e29b-41d4-a716-446655440099",
          payload
        )
      ).resolves.toEqual(mockResponse);

      expect(mockFetch.mock.calls[1]?.[0]).toEqual(
        expect.stringContaining(
          "/v1/me/passkeys/challenges/registration/550e8400-e29b-41d4-a716-446655440099/verify"
        )
      );
      expect(mockFetch.mock.calls[1]?.[1]).toMatchObject({
        method: "POST",
        credentials: "include",
        body: JSON.stringify(payload),
      });
    });
  });

  describe("deletePasskey", () => {
    it("deletes an enrolled passkey with DELETE /v1/me/passkeys/:credentialId", async () => {
      const mockResponse = {
        message: "Passkey deleted successfully.",
        data: { remaining_passkeys: 0 },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      await expect(deletePasskey("credential-id")).resolves.toEqual(
        mockResponse
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/me/passkeys/credential-id"),
        expect.objectContaining({
          method: "DELETE",
          credentials: "include",
          cache: "no-store",
        })
      );
    });

    it("surfaces JSON errors when passkey deletion fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: async () => ({
          message: "Passkey deletion failed.",
          code: "NOT_FOUND",
        }),
      } as Response);

      try {
        await deletePasskey("missing-credential-id");
        expect.fail("Expected deletePasskey to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthApiError);
        expect((error as AuthApiError).message).toBe(
          "Passkey deletion failed."
        );
        expect((error as AuthApiError).status).toBe(404);
        expect((error as AuthApiError).code).toBe("NOT_FOUND");
      }
    });
  });

  describe("startTotpEnrollment", () => {
    it("posts to /v1/me/mfa/totp/enrollment and returns enrollment data", async () => {
      const mockResponse = {
        data: {
          issuer: "SecPal",
          account_name: "test@secpal.dev",
          manual_entry_key: "JBSWY3DPEHPK3PXP",
          otpauth_uri:
            "otpauth://totp/SecPal:test@secpal.dev?secret=JBSWY3DPEHPK3PXP&issuer=SecPal",
          expires_at: "2026-04-01T09:25:00Z",
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => mockResponse,
      } as Response);

      await expect(startTotpEnrollment()).resolves.toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/me/mfa/totp/enrollment"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          cache: "no-store",
        })
      );
    });

    it("throws AuthApiError with status and code on JSON error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          message: "MFA is already enabled.",
          code: "CONFLICT",
        }),
      } as Response);

      try {
        await startTotpEnrollment();
        expect.fail("Expected startTotpEnrollment to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthApiError);
        expect((error as AuthApiError).status).toBe(409);
        expect((error as AuthApiError).code).toBe("CONFLICT");
      }
    });
  });

  describe("confirmTotpEnrollment", () => {
    it("posts TOTP code to /v1/me/mfa/totp/enrollment/confirm and returns recovery codes", async () => {
      const mockResponse = {
        data: {
          status: {
            enabled: true,
            method: "totp",
            recovery_codes_remaining: 8,
            recovery_codes_generated_at: "2026-04-01T09:12:00Z",
            enrolled_at: "2026-04-01T09:10:00Z",
          },
          recovery_codes: {
            codes: ["B6F42Q8P", "F9LM7N2R"],
            generated_at: "2026-04-01T09:12:00Z",
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await confirmTotpEnrollment({ code: "123456" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/me/mfa/totp/enrollment/confirm"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ code: "123456" }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it("throws AuthApiError with status and code on JSON error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          message: "The provided code is invalid.",
          code: "VALIDATION_ERROR",
        }),
      } as Response);

      try {
        await confirmTotpEnrollment({ code: "000000" });
        expect.fail("Expected confirmTotpEnrollment to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthApiError);
        expect((error as AuthApiError).status).toBe(422);
        expect((error as AuthApiError).code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("regenerateRecoveryCodes", () => {
    it("posts to /v1/me/mfa/recovery-codes/regenerate and returns new codes", async () => {
      const mockResponse = {
        data: {
          status: {
            enabled: true,
            method: "totp",
            recovery_codes_remaining: 8,
            recovery_codes_generated_at: "2026-04-01T10:00:00Z",
            enrolled_at: "2026-04-01T09:10:00Z",
          },
          recovery_codes: {
            codes: ["X3CE1RM6", "V7NK5HF9"],
            generated_at: "2026-04-01T10:00:00Z",
          },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await regenerateRecoveryCodes({
        method: "totp",
        code: "654321",
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/me/mfa/recovery-codes/regenerate"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
          body: JSON.stringify({ method: "totp", code: "654321" }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it("throws AuthApiError with status and code on JSON error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 409,
        json: async () => ({
          message: "The login challenge has expired.",
          code: "CONFLICT",
        }),
      } as Response);

      try {
        await regenerateRecoveryCodes({ method: "totp", code: "000000" });
        expect.fail("Expected regenerateRecoveryCodes to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthApiError);
        expect((error as AuthApiError).status).toBe(409);
        expect((error as AuthApiError).code).toBe("CONFLICT");
      }
    });
  });

  describe("disableMfa", () => {
    it("sends DELETE to /v1/me/mfa with verification code and returns updated status", async () => {
      const mockResponse = {
        data: {
          enabled: false,
          method: null,
          recovery_codes_remaining: 0,
          recovery_codes_generated_at: null,
          enrolled_at: null,
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      } as Response);

      const result = await disableMfa({ method: "totp", code: "123456" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/me/mfa"),
        expect.objectContaining({
          method: "DELETE",
          credentials: "include",
          body: JSON.stringify({ method: "totp", code: "123456" }),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it("throws AuthApiError with status and code on JSON error response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          message: "The provided code is invalid.",
          code: "VALIDATION_ERROR",
        }),
      } as Response);

      try {
        await disableMfa({ method: "totp", code: "000000" });
        expect.fail("Expected disableMfa to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthApiError);
        expect((error as AuthApiError).status).toBe(422);
        expect((error as AuthApiError).code).toBe("VALIDATION_ERROR");
      }
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

    it("stores optional status and code metadata", () => {
      const error = new AuthApiError("Conflict", undefined, 409, "CONFLICT");

      expect(error.status).toBe(409);
      expect(error.code).toBe("CONFLICT");
    });

    it("stores optional retry-after metadata", () => {
      const error = new AuthApiError(
        "Rate limited",
        undefined,
        429,
        undefined,
        90
      );

      expect(error.retryAfterSeconds).toBe(90);
    });
  });
});
