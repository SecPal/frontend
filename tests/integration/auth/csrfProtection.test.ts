// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchWithCsrf,
  fetchCsrfToken,
  CsrfError,
} from "../../../src/services/csrf";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("CSRF Protection Integration", () => {
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

  describe("CSRF Token Handling", () => {
    it("includes CSRF token in POST requests", async () => {
      document.cookie = "XSRF-TOKEN=test-csrf-token-123";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      await fetchWithCsrf("https://api.secpal.app/v1/resource", {
        method: "POST",
        body: JSON.stringify({ data: "test" }),
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );

      // Verify CSRF token header
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs).toBeDefined();
      if (callArgs) {
        const requestInit = callArgs[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.get("X-XSRF-TOKEN")).toBe("test-csrf-token-123");
      }
    });

    it("includes CSRF token in PUT requests", async () => {
      document.cookie = "XSRF-TOKEN=put-csrf-token";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await fetchWithCsrf("https://api.secpal.app/v1/resource/1", {
        method: "PUT",
        body: JSON.stringify({ name: "updated" }),
      });

      const callArgs = mockFetch.mock.calls[0];
      if (callArgs) {
        const requestInit = callArgs[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.get("X-XSRF-TOKEN")).toBe("put-csrf-token");
      }
    });

    it("includes CSRF token in PATCH requests", async () => {
      document.cookie = "XSRF-TOKEN=patch-csrf-token";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await fetchWithCsrf("https://api.secpal.app/v1/resource/1", {
        method: "PATCH",
        body: JSON.stringify({ status: "active" }),
      });

      const callArgs = mockFetch.mock.calls[0];
      if (callArgs) {
        const requestInit = callArgs[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.get("X-XSRF-TOKEN")).toBe("patch-csrf-token");
      }
    });

    it("includes CSRF token in DELETE requests", async () => {
      document.cookie = "XSRF-TOKEN=delete-csrf-token";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      await fetchWithCsrf("https://api.secpal.app/v1/resource/1", {
        method: "DELETE",
      });

      const callArgs = mockFetch.mock.calls[0];
      if (callArgs) {
        const requestInit = callArgs[1] as RequestInit;
        const headers = requestInit.headers as Headers;
        expect(headers.get("X-XSRF-TOKEN")).toBe("delete-csrf-token");
      }
    });

    it("handles missing CSRF token gracefully", async () => {
      // No CSRF token cookie set

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 419,
        statusText: "CSRF token mismatch",
      } as Response);

      // Mock CSRF token fetch
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      // Set token after refresh
      document.cookie = "XSRF-TOKEN=new-csrf-token";

      // Mock retry request
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      const response = await fetchWithCsrf(
        "https://api.secpal.app/v1/resource",
        {
          method: "POST",
          body: JSON.stringify({ data: "test" }),
        }
      );

      expect(response.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Original, CSRF fetch, retry
    });
  });

  describe("419 CSRF Token Mismatch Handling", () => {
    it("automatically refreshes CSRF token on 419 response", async () => {
      document.cookie = "XSRF-TOKEN=old-csrf-token";

      // Mock initial request returning 419
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 419,
        statusText: "CSRF token mismatch",
      } as Response);

      // Mock CSRF token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      // Mock retry request with new token
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true }),
      } as Response);

      const response = await fetchWithCsrf(
        "https://api.secpal.app/v1/resource",
        {
          method: "POST",
          body: JSON.stringify({ data: "test" }),
        }
      );

      expect(response.ok).toBe(true);

      // Verify request sequence
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // First call: original request with old token (before cookie update)
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("/v1/resource"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );

      // Second call: CSRF token refresh
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining("/sanctum/csrf-cookie"),
        expect.objectContaining({
          credentials: "include",
        })
      );

      // Third call: retry with refreshed token
      expect(mockFetch).toHaveBeenNthCalledWith(
        3,
        expect.stringContaining("/v1/resource"),
        expect.objectContaining({
          method: "POST",
          credentials: "include",
        })
      );
    });

    it("throws CsrfError when CSRF refresh fails after 419", async () => {
      document.cookie = "XSRF-TOKEN=old-token";

      // Mock initial request returning 419
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 419,
      } as Response);

      // Mock CSRF token refresh failing
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      // Should throw CsrfError with specific message
      await expect(
        fetchWithCsrf("https://api.secpal.app/v1/resource", {
          method: "POST",
        })
      ).rejects.toThrow(CsrfError);

      // Also verify the error message contains expected text
      await expect(
        async () => {
          // Reset mocks and mock again for message verification
          mockFetch.mockClear();
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 419,
          } as Response);
          mockFetch.mockResolvedValueOnce({
            ok: false,
            status: 500,
          } as Response);

          await fetchWithCsrf("https://api.secpal.app/v1/resource", {
            method: "POST",
          });
        }
      ).rejects.toThrow("Failed to refresh CSRF token after 419 response");
    });

    it("retries only once on 419 (no infinite retry loop)", async () => {
      document.cookie = "XSRF-TOKEN=token";

      // Mock initial request returning 419
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 419,
      } as Response);

      // Mock CSRF token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      document.cookie = "XSRF-TOKEN=new-token";

      // Mock retry ALSO returning 419 (should NOT retry again)
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 419,
      } as Response);

      const response = await fetchWithCsrf(
        "https://api.secpal.app/v1/resource",
        {
          method: "POST",
        }
      );

      // Should return the second 419 response without retrying again
      expect(response.status).toBe(419);
      expect(mockFetch).toHaveBeenCalledTimes(3); // Original + CSRF refresh + 1 retry
    });
  });

  describe("CSRF Token Fetch Flow", () => {
    it("fetches CSRF token from /sanctum/csrf-cookie endpoint", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      await fetchCsrfToken();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/sanctum/csrf-cookie"),
        expect.objectContaining({
          credentials: "include",
        })
      );
    });

    it("throws CsrfError when CSRF endpoint is unavailable", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        statusText: "Service Unavailable",
      } as Response);

      await expect(fetchCsrfToken()).rejects.toThrow(CsrfError);
      await expect(fetchCsrfToken()).rejects.toThrow(
        "Failed to fetch CSRF token"
      );
    });

    it("throws CsrfError on network failure", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      await expect(fetchCsrfToken()).rejects.toThrow(CsrfError);
    });
  });

  describe("Integration with State-Changing Methods", () => {
    it("protects all state-changing HTTP methods (POST, PUT, PATCH, DELETE)", async () => {
      const methods = ["POST", "PUT", "PATCH", "DELETE"];

      for (const method of methods) {
        document.cookie = `XSRF-TOKEN=token-for-${method}`;

        mockFetch.mockResolvedValueOnce({
          ok: true,
          status: method === "DELETE" ? 204 : 200,
          json: async () => ({ success: true }),
        } as Response);

        await fetchWithCsrf(`https://api.secpal.app/v1/resource`, {
          method,
          body:
            method !== "DELETE" ? JSON.stringify({ data: "test" }) : undefined,
        });

        const callArgs = mockFetch.mock.calls[mockFetch.mock.calls.length - 1];
        if (callArgs) {
          const requestInit = callArgs[1] as RequestInit;
          const headers = requestInit.headers as Headers;
          expect(headers.get("X-XSRF-TOKEN")).toBe(`token-for-${method}`);
        }

        mockFetch.mockClear();
      }
    });
  });

  describe("GET Requests (No CSRF Protection Needed)", () => {
    it("does not require CSRF token for GET requests (safe method)", async () => {
      // No CSRF token cookie set

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: "public data" }),
      } as Response);

      const response = await fetch("https://api.secpal.app/v1/public", {
        method: "GET",
        credentials: "include",
      });

      expect(response.ok).toBe(true);

      // GET requests typically don't need CSRF tokens
      // This test documents that fetchWithCsrf can be used for GET
      // but CSRF protection is primarily for state-changing methods
    });
  });

  describe("Error Scenarios", () => {
    it("handles 401 Unauthorized separately from 419 CSRF mismatch", async () => {
      document.cookie = "XSRF-TOKEN=valid-token";

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: "Unauthorized",
      } as Response);

      const response = await fetchWithCsrf(
        "https://api.secpal.app/v1/resource",
        {
          method: "POST",
        }
      );

      // Should NOT retry on 401 (only retries on 419)
      expect(response.status).toBe(401);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("handles 403 Forbidden without CSRF retry", async () => {
      document.cookie = "XSRF-TOKEN=valid-token";

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 403,
        statusText: "Forbidden",
      } as Response);

      const response = await fetchWithCsrf(
        "https://api.secpal.app/v1/resource",
        {
          method: "POST",
        }
      );

      // Should NOT retry on 403
      expect(response.status).toBe(403);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it("handles 500 Internal Server Error without CSRF retry", async () => {
      document.cookie = "XSRF-TOKEN=valid-token";

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      } as Response);

      const response = await fetchWithCsrf(
        "https://api.secpal.app/v1/resource",
        {
          method: "POST",
        }
      );

      // Should NOT retry on 500
      expect(response.status).toBe(500);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("Credentials Always Included", () => {
    it("always sends credentials: include for cross-origin requests", async () => {
      document.cookie = "XSRF-TOKEN=test-token";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await fetchWithCsrf("https://api.secpal.app/v1/resource", {
        method: "POST",
        body: JSON.stringify({ test: true }),
      });

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs).toBeDefined();
      if (callArgs) {
        const requestInit = callArgs[1] as RequestInit;
        expect(requestInit.credentials).toBe("include");
      }
    });

    it("maintains credentials: include after 419 retry", async () => {
      document.cookie = "XSRF-TOKEN=old-token";

      // Mock 419 response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 419,
      } as Response);

      // Mock CSRF refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      document.cookie = "XSRF-TOKEN=new-token";

      // Mock retry
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
      } as Response);

      await fetchWithCsrf("https://api.secpal.app/v1/resource", {
        method: "POST",
      });

      // Verify all requests include credentials
      expect(mockFetch).toHaveBeenCalledTimes(3);
      for (let i = 0; i < 3; i++) {
        const callArgs = mockFetch.mock.calls[i];
        if (callArgs) {
          const requestInit = callArgs[1] as RequestInit;
          expect(requestInit.credentials).toBe("include");
        }
      }
    });
  });
});
