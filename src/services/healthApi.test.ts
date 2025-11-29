// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { checkHealth, HealthCheckError, HealthStatus } from "./healthApi";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("healthApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("checkHealth", () => {
    it("returns health status when all checks pass (200 OK)", async () => {
      const mockHealthResponse: HealthStatus = {
        status: "ready",
        checks: {
          database: "ok",
          tenant_keys: "ok",
          kek_file: "ok",
        },
        timestamp: "2025-11-29T10:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHealthResponse,
      } as Response);

      const result = await checkHealth();

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/health/ready"),
        expect.objectContaining({
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        })
      );

      expect(result).toEqual(mockHealthResponse);
      expect(result.status).toBe("ready");
    });

    it("returns health status when checks fail (503 Service Unavailable)", async () => {
      const mockHealthResponse: HealthStatus = {
        status: "not_ready",
        checks: {
          database: "ok",
          tenant_keys: "missing",
          kek_file: "ok",
        },
        timestamp: "2025-11-29T10:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => mockHealthResponse,
      } as Response);

      const result = await checkHealth();

      expect(result).toEqual(mockHealthResponse);
      expect(result.status).toBe("not_ready");
      expect(result.checks.tenant_keys).toBe("missing");
    });

    it("throws HealthCheckError on unexpected status code", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: "Internal Server Error" }),
      } as Response);

      await expect(checkHealth()).rejects.toThrow(HealthCheckError);
      await expect(checkHealth()).rejects.toThrow(/Unexpected health check/);
    });

    it("throws HealthCheckError on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network request failed"));

      await expect(checkHealth()).rejects.toThrow(HealthCheckError);
      await expect(checkHealth()).rejects.toThrow(/Network request failed/);
    });

    it("throws HealthCheckError on timeout", async () => {
      // Mock fetch that returns a promise that rejects with AbortError
      const abortError = new Error("Aborted");
      abortError.name = "AbortError";
      mockFetch.mockRejectedValue(abortError);

      await expect(checkHealth()).rejects.toThrow(HealthCheckError);
      await expect(checkHealth()).rejects.toThrow(/timed out/);
    });

    it("includes correct headers in request", async () => {
      const mockHealthResponse: HealthStatus = {
        status: "ready",
        checks: {
          database: "ok",
          tenant_keys: "ok",
          kek_file: "ok",
        },
        timestamp: "2025-11-29T10:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockHealthResponse,
      } as Response);

      await checkHealth();

      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs).toBeDefined();
      if (callArgs) {
        const requestInit = callArgs[1] as RequestInit;
        expect(requestInit.headers).toEqual({ Accept: "application/json" });
      }
    });

    it("parses all check statuses correctly", async () => {
      const mockHealthResponse: HealthStatus = {
        status: "not_ready",
        checks: {
          database: "error",
          tenant_keys: "error",
          kek_file: "missing",
        },
        timestamp: "2025-11-29T10:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
        json: async () => mockHealthResponse,
      } as Response);

      const result = await checkHealth();

      expect(result.checks.database).toBe("error");
      expect(result.checks.tenant_keys).toBe("error");
      expect(result.checks.kek_file).toBe("missing");
    });
  });

  describe("HealthCheckError", () => {
    it("includes status code when provided", () => {
      const error = new HealthCheckError("Test error", 503);

      expect(error.message).toBe("Test error");
      expect(error.status).toBe(503);
      expect(error.name).toBe("HealthCheckError");
    });

    it("works without status code", () => {
      const error = new HealthCheckError("Test error");

      expect(error.message).toBe("Test error");
      expect(error.status).toBeUndefined();
    });
  });
});
