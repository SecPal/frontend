// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  fetchShares,
  createShare,
  revokeShare,
  ApiError,
  type CreateShareRequest,
} from "./shareApi";
import type { SecretShare } from "./secretApi";
import { apiConfig } from "../config";

// Mock apiFetch (central API wrapper)
vi.mock("./csrf", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./csrf";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockApiFetch = apiFetch as any;

describe("shareApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchShares", () => {
    const mockShares: SecretShare[] = [
      {
        id: "share-1",
        user: { id: "user-1", name: "John Doe" },
        permission: "read",
        granted_by: { id: "owner-1", name: "Owner" },
        granted_at: "2025-11-01T10:00:00Z",
      },
    ];

    it("should fetch shares for a secret successfully", async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockShares }),
      });

      const shares = await fetchShares("secret-1");

      expect(shares).toEqual(mockShares);
      expect(mockApiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/secrets/secret-1/shares`,
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should return empty array when no shares exist", async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [] }),
      });

      const shares = await fetchShares("secret-2");

      expect(shares).toEqual([]);
    });

    it("should throw ApiError on 403 Forbidden", async () => {
      mockApiFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "Forbidden" }),
      });

      await expect(fetchShares("secret-1")).rejects.toThrow(ApiError);
      await expect(fetchShares("secret-1")).rejects.toThrow("Forbidden");
    });

    it("should throw ApiError on 404 Not Found", async () => {
      mockApiFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Secret not found" }),
      });

      await expect(fetchShares("nonexistent")).rejects.toThrow(ApiError);
    });

    it("should throw error on network failure", async () => {
      mockApiFetch.mockRejectedValue(new Error("Network error"));

      await expect(fetchShares("secret-1")).rejects.toThrow("Network error");
    });
  });

  describe("createShare", () => {
    const mockShare: SecretShare = {
      id: "share-1",
      user: { id: "user-1", name: "John Doe" },
      permission: "read",
      granted_by: { id: "owner-1", name: "You" },
      granted_at: "2025-11-20T10:00:00Z",
    };

    it("should create share with user successfully", async () => {
      const request: CreateShareRequest = {
        user_id: "user-1",
        permission: "read",
      };

      mockApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockShare }),
      });

      const share = await createShare("secret-1", request);

      expect(share).toEqual(mockShare);
      expect(mockApiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/secrets/secret-1/shares`,
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(request),
        })
      );
    });

    it("should create share with role successfully", async () => {
      const request: CreateShareRequest = {
        role_id: "role-1",
        permission: "write",
      };

      const roleShare = {
        ...mockShare,
        role: { id: "role-1", name: "Admins" },
        user: undefined,
      };

      mockApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: roleShare }),
      });

      const share = await createShare("secret-1", request);

      expect(share).toEqual(roleShare);
    });

    it("should create share with expiration date", async () => {
      const request: CreateShareRequest = {
        user_id: "user-1",
        permission: "read",
        expires_at: "2026-01-01T00:00:00Z",
      };

      const expiringShare = {
        ...mockShare,
        expires_at: "2026-01-01T00:00:00Z",
      };

      mockApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: expiringShare }),
      });

      const share = await createShare("secret-1", request);

      expect(share.expires_at).toBe("2026-01-01T00:00:00Z");
    });

    it("should throw ApiError on 422 validation error", async () => {
      const request: CreateShareRequest = {
        user_id: "user-1",
        permission: "read",
      };

      mockApiFetch.mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({ message: "User already has access" }),
      });

      await expect(createShare("secret-1", request)).rejects.toThrow(ApiError);
      await expect(createShare("secret-1", request)).rejects.toThrow(
        "User already has access"
      );
    });

    it("should throw ApiError on 403 Forbidden (not owner)", async () => {
      const request: CreateShareRequest = {
        user_id: "user-1",
        permission: "read",
      };

      mockApiFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "Only owner can share" }),
      });

      await expect(createShare("secret-1", request)).rejects.toThrow(ApiError);
    });
  });

  describe("revokeShare", () => {
    it("should revoke share successfully", async () => {
      mockApiFetch.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      await expect(revokeShare("secret-1", "share-1")).resolves.toBeUndefined();

      expect(mockApiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/secrets/secret-1/shares/share-1`,
        expect.objectContaining({
          method: "DELETE",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });

    it("should throw ApiError on 404 Not Found", async () => {
      mockApiFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Share not found" }),
      });

      await expect(revokeShare("secret-1", "nonexistent")).rejects.toThrow(
        ApiError
      );
    });

    it("should throw ApiError on 403 Forbidden", async () => {
      mockApiFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "Cannot revoke this share" }),
      });

      await expect(revokeShare("secret-1", "share-1")).rejects.toThrow(
        ApiError
      );
    });
  });
});
