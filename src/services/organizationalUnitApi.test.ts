// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listOrganizationalUnits,
  getOrganizationalUnit,
  createOrganizationalUnit,
  updateOrganizationalUnit,
  deleteOrganizationalUnit,
  getOrganizationalUnitDescendants,
  getOrganizationalUnitAncestors,
  attachOrganizationalUnitParent,
  detachOrganizationalUnitParent,
  getMyOrganizationalScopes,
} from "./organizationalUnitApi";
import { ApiError } from "./secretApi";
import { apiConfig } from "../config";
import type {
  OrganizationalUnit,
  PaginatedResponse,
} from "../types/organizational";

// Mock fetchWithCsrf
vi.mock("./csrf", () => ({
  fetchWithCsrf: vi.fn(),
}));

import { fetchWithCsrf } from "./csrf";

describe("Organizational Unit API", () => {
  const mockFetch = vi.fn();
  const mockFetchWithCsrf = vi.mocked(fetchWithCsrf);

  const mockUnit: OrganizationalUnit = {
    id: "unit-1",
    type: "branch",
    name: "Berlin Branch",
    description: "Main branch in Berlin",
    metadata: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  describe("listOrganizationalUnits", () => {
    it("should fetch organizational units successfully", async () => {
      const mockResponse: PaginatedResponse<OrganizationalUnit> = {
        data: [mockUnit],
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await listOrganizationalUnits();

      expect(result.data).toEqual([mockUnit]);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/organizational-units`,
        expect.objectContaining({ method: "GET", credentials: "include" })
      );
    });

    it("should apply filters correctly", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: {} }),
      });

      await listOrganizationalUnits({
        type: "branch",
        parent_id: "parent-1",
        per_page: 10,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("type=branch"),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("parent_id=parent-1"),
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("per_page=10"),
        expect.any(Object)
      );
    });

    it("should throw ApiError on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "Forbidden" }),
      });

      await expect(listOrganizationalUnits()).rejects.toThrow(ApiError);
      await expect(listOrganizationalUnits()).rejects.toThrow("Forbidden");
    });
  });

  describe("getOrganizationalUnit", () => {
    it("should fetch a single unit successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockUnit }),
      });

      const result = await getOrganizationalUnit("unit-1");

      expect(result).toEqual(mockUnit);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/organizational-units/unit-1`,
        expect.objectContaining({ method: "GET" })
      );
    });

    it("should throw ApiError when unit not found", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Not found" }),
      });

      await expect(getOrganizationalUnit("invalid")).rejects.toThrow(ApiError);
    });
  });

  describe("createOrganizationalUnit", () => {
    it("should create a unit successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockUnit }),
      } as Response);

      const result = await createOrganizationalUnit({
        name: "Berlin Branch",
        type: "branch",
      });

      expect(result).toEqual(mockUnit);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/organizational-units`,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Berlin Branch"),
        })
      );
    });

    it("should throw ApiError with validation errors", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          message: "Validation failed",
          errors: { name: ["Name is required"] },
        }),
      } as Response);

      try {
        await createOrganizationalUnit({ name: "", type: "branch" });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).errors).toEqual({
          name: ["Name is required"],
        });
      }
    });
  });

  describe("updateOrganizationalUnit", () => {
    it("should update a unit successfully", async () => {
      const updatedUnit = { ...mockUnit, name: "Updated Branch" };
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: updatedUnit }),
      } as Response);

      const result = await updateOrganizationalUnit("unit-1", {
        name: "Updated Branch",
      });

      expect(result.name).toBe("Updated Branch");
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/organizational-units/unit-1`,
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  describe("deleteOrganizationalUnit", () => {
    it("should delete a unit successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await expect(deleteOrganizationalUnit("unit-1")).resolves.toBeUndefined();
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/organizational-units/unit-1`,
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("getOrganizationalUnitDescendants", () => {
    it("should fetch descendants successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [mockUnit] }),
      });

      const result = await getOrganizationalUnitDescendants("unit-1");

      expect(result).toEqual([mockUnit]);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/organizational-units/unit-1/descendants`,
        expect.any(Object)
      );
    });
  });

  describe("getOrganizationalUnitAncestors", () => {
    it("should fetch ancestors successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [mockUnit] }),
      });

      const result = await getOrganizationalUnitAncestors("unit-1");

      expect(result).toEqual([mockUnit]);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/organizational-units/unit-1/ancestors`,
        expect.any(Object)
      );
    });
  });

  describe("attachOrganizationalUnitParent", () => {
    it("should attach parent successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockUnit }),
      } as Response);

      const result = await attachOrganizationalUnitParent("unit-1", "parent-1");

      expect(result).toEqual(mockUnit);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/organizational-units/unit-1/parent`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ parent_id: "parent-1" }),
        })
      );
    });
  });

  describe("detachOrganizationalUnitParent", () => {
    it("should detach parent successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await expect(
        detachOrganizationalUnitParent("unit-1", "parent-1")
      ).resolves.toBeUndefined();
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/organizational-units/unit-1/parent/parent-1`,
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("getMyOrganizationalScopes", () => {
    it("should fetch user scopes successfully", async () => {
      const mockScopes = [
        {
          id: "scope-1",
          user_id: "user-1",
          organizational_unit_id: "unit-1",
          organizational_unit: mockUnit,
          include_descendants: true,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockScopes }),
      });

      const result = await getMyOrganizationalScopes();

      expect(result).toEqual(mockScopes);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/me/organizational-scopes`,
        expect.any(Object)
      );
    });
  });
});
