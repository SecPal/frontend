// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchLeadershipLevels,
  fetchAvailableLeadershipLevels,
  fetchInactiveLeadershipLevels,
  searchLeadershipLevels,
  fetchLeadershipLevel,
  createLeadershipLevel,
  updateLeadershipLevel,
  deleteLeadershipLevel,
  forceDeleteLeadershipLevel,
  restoreLeadershipLevel,
  reorderLeadershipLevels,
} from "./leadershipLevelApi";
import type { LeadershipLevelFormData } from "../types/leadershipLevel";
import { apiConfig } from "../config";
import * as csrf from "./csrf";

// Mock apiFetch
vi.mock("./csrf");

describe("LeadershipLevel API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchLeadershipLevels", () => {
    it("should fetch paginated leadership levels", async () => {
      const mockResponse = {
        data: [
          {
            id: "level-1",
            tenant_id: 1,
            rank: 1,
            name: "Managing Director",
            description: "CEO",
            color: "#FF5733",
            is_active: true,
            employees_count: 5,
            created_at: "2025-12-21T00:00:00Z",
            updated_at: "2025-12-21T00:00:00Z",
          },
        ],
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 15,
          total: 1,
        },
      };

      vi.mocked(csrf.apiFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      const result = await fetchLeadershipLevels({ page: 1, per_page: 15 });

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/leadership-levels?page=1&per_page=15`,
        { method: "GET" }
      );
      expect(result).toEqual(mockResponse);
    });

    it("should include inactive levels when requested", async () => {
      const mockResponse = {
        data: [],
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 15,
          total: 0,
        },
      };

      vi.mocked(csrf.apiFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      } as Response);

      await fetchLeadershipLevels({ include_inactive: true });

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/leadership-levels?include_inactive=true`,
        { method: "GET" }
      );
    });
  });

  describe("fetchAvailableLeadershipLevels", () => {
    it("should fetch only active leadership levels", async () => {
      const mockData = {
        data: [
          {
            id: "level-1",
            tenant_id: 1,
            rank: 1,
            name: "Managing Director",
            is_active: true,
            created_at: "2025-12-21T00:00:00Z",
            updated_at: "2025-12-21T00:00:00Z",
          },
        ],
      };

      vi.mocked(csrf.apiFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await fetchAvailableLeadershipLevels();

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/leadership-levels/available`,
        { method: "GET" }
      );
      expect(result).toEqual(mockData.data);
    });
  });

  describe("fetchInactiveLeadershipLevels", () => {
    it("should fetch only inactive leadership levels", async () => {
      const mockData = {
        data: [
          {
            id: "level-2",
            tenant_id: 1,
            rank: 10,
            name: "Deprecated Role",
            is_active: false,
            created_at: "2025-12-21T00:00:00Z",
            updated_at: "2025-12-21T00:00:00Z",
          },
        ],
      };

      vi.mocked(csrf.apiFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await fetchInactiveLeadershipLevels();

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/leadership-levels/inactive`,
        { method: "GET" }
      );
      expect(result).toEqual(mockData.data);
    });
  });

  describe("searchLeadershipLevels", () => {
    it("should search leadership levels by query", async () => {
      const mockData = {
        data: [
          {
            id: "level-1",
            tenant_id: 1,
            rank: 2,
            name: "Branch Director",
            is_active: true,
            created_at: "2025-12-21T00:00:00Z",
            updated_at: "2025-12-21T00:00:00Z",
          },
        ],
      };

      vi.mocked(csrf.apiFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await searchLeadershipLevels("director");

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/leadership-levels/search?q=director`,
        { method: "GET" }
      );
      expect(result).toEqual(mockData.data);
    });
  });

  describe("fetchLeadershipLevel", () => {
    it("should fetch single leadership level", async () => {
      const mockData = {
        data: {
          id: "level-1",
          tenant_id: 1,
          rank: 1,
          name: "Managing Director",
          description: "CEO",
          color: "#FF5733",
          is_active: true,
          created_at: "2025-12-21T00:00:00Z",
          updated_at: "2025-12-21T00:00:00Z",
        },
      };

      vi.mocked(csrf.apiFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await fetchLeadershipLevel("level-1");

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/leadership-levels/level-1`,
        { method: "GET" }
      );
      expect(result).toEqual(mockData.data);
    });
  });

  describe("createLeadershipLevel", () => {
    it("should create new leadership level", async () => {
      const formData: LeadershipLevelFormData = {
        rank: 5,
        name: "Area Manager",
        description: "Manages multiple sites",
        color: "#00AA00",
        is_active: true,
      };

      const mockData = {
        data: {
          id: "level-new",
          tenant_id: 1,
          ...formData,
          created_at: "2025-12-25T00:00:00Z",
          updated_at: "2025-12-25T00:00:00Z",
        },
      };

      vi.mocked(csrf.apiFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await createLeadershipLevel(formData);

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/leadership-levels`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        }
      );
      expect(result).toEqual(mockData.data);
    });
  });

  describe("updateLeadershipLevel", () => {
    it("should update existing leadership level", async () => {
      const updates = {
        name: "Senior Area Manager",
        description: "Updated description",
      };

      const mockData = {
        data: {
          id: "level-1",
          tenant_id: 1,
          rank: 5,
          name: "Senior Area Manager",
          description: "Updated description",
          color: "#00AA00",
          is_active: true,
          created_at: "2025-12-21T00:00:00Z",
          updated_at: "2025-12-25T00:00:00Z",
        },
      };

      vi.mocked(csrf.apiFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => mockData,
      } as Response);

      const result = await updateLeadershipLevel("level-1", updates);

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/leadership-levels/level-1`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        }
      );
      expect(result).toEqual(mockData.data);
    });
  });

  describe("deleteLeadershipLevel", () => {
    it("should soft delete leadership level", async () => {
      vi.mocked(csrf.apiFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await deleteLeadershipLevel("level-1");

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/leadership-levels/level-1`,
        { method: "DELETE" }
      );
    });

    it("should throw error if employees are assigned", async () => {
      vi.mocked(csrf.apiFetch).mockResolvedValueOnce({
        ok: false,
        status: 422,
        json: async () => ({
          message: "Cannot delete level with assigned employees",
        }),
      } as Response);

      await expect(deleteLeadershipLevel("level-1")).rejects.toThrow();
    });
  });

  describe("forceDeleteLeadershipLevel", () => {
    it("should permanently delete leadership level", async () => {
      vi.mocked(csrf.apiFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await forceDeleteLeadershipLevel("level-1");

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/leadership-levels/level-1/force`,
        { method: "DELETE" }
      );
    });
  });

  describe("restoreLeadershipLevel", () => {
    it("should restore soft-deleted leadership level", async () => {
      vi.mocked(csrf.apiFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await restoreLeadershipLevel("level-1");

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/leadership-levels/level-1/restore`,
        { method: "POST" }
      );
    });
  });

  describe("reorderLeadershipLevels", () => {
    it("should update ranks via drag-and-drop", async () => {
      const reorderedIds = ["level-3", "level-1", "level-2"];

      vi.mocked(csrf.apiFetch).mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      } as Response);

      await reorderLeadershipLevels(reorderedIds);

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/leadership-levels/reorder`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ordered_ids: reorderedIds }),
        }
      );
    });
  });
});
