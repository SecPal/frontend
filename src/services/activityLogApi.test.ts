// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchActivityLogs, verifyActivityLog } from "./activityLogApi";
import type {
  Activity,
  ActivityVerification,
  ActivityFilters,
} from "./activityLogApi";
import * as csrf from "./csrf";

// Mock apiFetch
vi.mock("./csrf", () => ({
  apiFetch: vi.fn(),
}));

describe("activityLogApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchActivityLogs", () => {
    const mockActivity: Activity = {
      id: "log-1",
      tenant_id: "tenant-1",
      organizational_unit_id: "unit-1",
      log_name: "default",
      description: "User logged in",
      subject_type: "App\\Models\\User",
      subject_id: "user-1",
      subject: { id: "user-1", name: "John Doe" },
      causer_type: "App\\Models\\User",
      causer_id: "user-1",
      causer: { id: "user-1", name: "John Doe", email: "john@example.com" },
      properties: { ip: "192.168.1.1" },
      event_hash: "abc123",
      previous_hash: null,
      security_level: 1,
      merkle_root: null,
      merkle_batch_id: null,
      merkle_proof: null,
      opentimestamp_proof: null,
      opentimestamp_merkle_root: null,
      opentimestamp_proof_confirmed: false,
      ots_confirmed_at: null,
      is_orphaned_genesis: false,
      orphaned_reason: null,
      orphaned_at: null,
      created_at: "2025-12-27T10:00:00Z",
      updated_at: "2025-12-27T10:00:00Z",
      organizational_unit: {
        id: "unit-1",
        name: "Engineering",
        unit_type: "department",
      },
    };

    it("should fetch activity logs successfully", async () => {
      const mockResponse = {
        data: [mockActivity],
        meta: {
          current_page: 1,
          from: 1,
          last_page: 1,
          per_page: 50,
          to: 1,
          total: 1,
        },
        links: {
          first: "/v1/activity-logs?page=1",
          last: "/v1/activity-logs?page=1",
          prev: null,
          next: null,
        },
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetchActivityLogs();

      // When no filters are passed, URL has no query params
      expect(csrf.apiFetch).toHaveBeenCalledWith("/v1/activity-logs");
      expect(result).toEqual(mockResponse);
      expect(result.data).toHaveLength(1);
      expect(result.data[0]?.id).toBe("log-1");
    });

    it("should apply filters to the request", async () => {
      const filters: ActivityFilters = {
        search: "login",
        log_name: "auth",
        from_date: "2025-12-01",
        to_date: "2025-12-31",
        organizational_unit_id: "unit-1",
        page: 2,
        per_page: 25,
      };

      const mockResponse = {
        data: [],
        meta: {
          current_page: 2,
          from: 26,
          last_page: 1,
          per_page: 25,
          to: 25,
          total: 0,
        },
        links: {
          first: null,
          last: null,
          prev: null,
          next: null,
        },
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await fetchActivityLogs(filters);

      const callArg = vi.mocked(csrf.apiFetch).mock.calls[0]?.[0] as string;
      expect(callArg).toContain("search=login");
      expect(callArg).toContain("log_name=auth");
      expect(callArg).toContain("from_date=2025-12-01");
      expect(callArg).toContain("to_date=2025-12-31");
      expect(callArg).toContain("organizational_unit_id=unit-1");
      expect(callArg).toContain("page=2");
      expect(callArg).toContain("per_page=25");
    });

    it("should handle API errors", async () => {
      vi.mocked(csrf.apiFetch).mockRejectedValue(new Error("Network error"));

      await expect(fetchActivityLogs()).rejects.toThrow("Network error");
    });

    it("should omit empty filter values", async () => {
      const filters: ActivityFilters = {
        search: undefined,
        log_name: "",
        from_date: undefined,
      };

      const mockResponse = {
        data: [],
        meta: {
          current_page: 1,
          from: 0,
          last_page: 1,
          per_page: 50,
          to: 0,
          total: 0,
        },
        links: { first: null, last: null, prev: null, next: null },
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await fetchActivityLogs(filters);

      const callArg = vi.mocked(csrf.apiFetch).mock.calls[0]?.[0] as string;
      expect(callArg).not.toContain("search=");
      expect(callArg).not.toContain("from_date=");
    });

    it("should handle pagination parameters", async () => {
      const mockResponse = {
        data: [],
        meta: {
          current_page: 5,
          from: 201,
          last_page: 10,
          per_page: 50,
          to: 250,
          total: 500,
        },
        links: {
          first: "/v1/activity-logs?page=1",
          last: "/v1/activity-logs?page=10",
          prev: "/v1/activity-logs?page=4",
          next: "/v1/activity-logs?page=6",
        },
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetchActivityLogs({ page: 5, per_page: 50 });

      expect(result.meta.current_page).toBe(5);
      expect(result.meta.last_page).toBe(10);
      expect(result.meta.total).toBe(500);
    });
  });

  describe("verifyActivityLog", () => {
    const mockVerification: ActivityVerification = {
      activity_id: "log-1",
      verification: {
        chain_valid: true,
        merkle_valid: true,
        ots_valid: true,
      },
      details: {
        event_hash: "abc123",
        previous_hash: "def456",
        merkle_root: "merkle-root-hash",
        merkle_batch_id: "batch-123",
        ots_confirmed_at: "2025-12-27T12:00:00Z",
        is_orphaned_genesis: false,
        orphaned_reason: null,
      },
    };

    it("should verify activity log successfully", async () => {
      vi.mocked(csrf.apiFetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockVerification }),
      } as Response);

      const result = await verifyActivityLog("log-1");

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        "/v1/activity-logs/log-1/verify"
      );
      expect(result).toEqual({ data: mockVerification });
      expect(result.data.verification.chain_valid).toBe(true);
      expect(result.data.verification.merkle_valid).toBe(true);
      expect(result.data.verification.ots_valid).toBe(true);
    });

    it("should handle invalid verification results", async () => {
      const invalidVerification: ActivityVerification = {
        activity_id: "log-2",
        verification: {
          chain_valid: false,
          merkle_valid: false,
          ots_valid: null,
        },
        details: {
          event_hash: "ghi789",
          previous_hash: null,
          merkle_root: null,
          merkle_batch_id: null,
          ots_confirmed_at: null,
          is_orphaned_genesis: true,
          orphaned_reason: "Previous log not found",
        },
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: invalidVerification }),
      } as Response);

      const result = await verifyActivityLog("log-2");

      expect(result.data.verification.chain_valid).toBe(false);
      expect(result.data.verification.merkle_valid).toBe(false);
      expect(result.data.verification.ots_valid).toBe(null);
      expect(result.data.details.is_orphaned_genesis).toBe(true);
    });

    it("should handle pending OpenTimestamp", async () => {
      const pendingVerification: ActivityVerification = {
        activity_id: "log-3",
        verification: {
          chain_valid: true,
          merkle_valid: true,
          ots_valid: null,
        },
        details: {
          event_hash: "jkl012",
          previous_hash: "mno345",
          merkle_root: "merkle-pending",
          merkle_batch_id: "batch-456",
          ots_confirmed_at: null,
          is_orphaned_genesis: false,
          orphaned_reason: null,
        },
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: pendingVerification }),
      } as Response);

      const result = await verifyActivityLog("log-3");

      expect(result.data.verification.ots_valid).toBe(null);
      expect(result.data.details.ots_confirmed_at).toBe(null);
    });

    it("should handle API errors during verification", async () => {
      vi.mocked(csrf.apiFetch).mockRejectedValue(
        new Error("Verification service unavailable")
      );

      await expect(verifyActivityLog("log-1")).rejects.toThrow(
        "Verification service unavailable"
      );
    });

    it("should handle 404 errors for non-existent logs", async () => {
      vi.mocked(csrf.apiFetch).mockRejectedValue(
        new Error("Activity log not found")
      );

      await expect(verifyActivityLog("invalid-id")).rejects.toThrow(
        "Activity log not found"
      );
    });
  });
});
