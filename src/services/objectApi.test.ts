// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listObjects,
  getObject,
  createObject,
  updateObject,
  deleteObject,
  getObjectAreas,
  createObjectArea,
  listObjectAreas,
  getObjectArea,
  updateObjectArea,
  deleteObjectArea,
} from "./objectApi";
import { ApiError } from "./secretApi";
import { apiConfig } from "../config";
import type {
  SecPalObject,
  ObjectArea,
  PaginatedResponse,
} from "../types/organizational";

// Mock fetchWithCsrf
vi.mock("./csrf", () => ({
  fetchWithCsrf: vi.fn(),
}));

import { fetchWithCsrf } from "./csrf";

describe("Object API", () => {
  const mockFetch = vi.fn();
  const mockFetchWithCsrf = vi.mocked(fetchWithCsrf);

  const mockObject: SecPalObject = {
    id: "obj-1",
    object_number: "OBJ-001",
    name: "Rewe Markt Hamburg",
    address: "Große Bergstraße 160, 22767 Hamburg",
    gps_coordinates: { lat: 53.5511, lon: 9.9937 },
    metadata: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  const mockArea: ObjectArea = {
    id: "area-1",
    name: "Terminal 1",
    description: "Main terminal area",
    requires_separate_guard_book: true,
    geofence_boundaries: null,
    metadata: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  // ============================================================================
  // Object Tests
  // ============================================================================

  describe("listObjects", () => {
    it("should fetch objects successfully", async () => {
      const mockResponse: PaginatedResponse<SecPalObject> = {
        data: [mockObject],
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await listObjects();

      expect(result.data).toEqual([mockObject]);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/objects`,
        expect.objectContaining({ method: "GET", credentials: "include" })
      );
    });

    it("should apply customer_id filter", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: {} }),
      });

      await listObjects({ customer_id: "cust-1" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("customer_id=cust-1"),
        expect.any(Object)
      );
    });

    it("should throw ApiError on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "Forbidden" }),
      });

      await expect(listObjects()).rejects.toThrow(ApiError);
    });
  });

  describe("getObject", () => {
    it("should fetch a single object successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockObject }),
      });

      const result = await getObject("obj-1");

      expect(result).toEqual(mockObject);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/objects/obj-1`,
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("createObject", () => {
    it("should create an object successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockObject }),
      } as Response);

      const result = await createObject({
        customer_id: "cust-1",
        object_number: "OBJ-001",
        name: "Rewe Markt Hamburg",
      });

      expect(result).toEqual(mockObject);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/objects`,
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("updateObject", () => {
    it("should update an object successfully", async () => {
      const updatedObject = { ...mockObject, name: "Updated Name" };
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: updatedObject }),
      } as Response);

      const result = await updateObject("obj-1", { name: "Updated Name" });

      expect(result.name).toBe("Updated Name");
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/objects/obj-1`,
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  describe("deleteObject", () => {
    it("should delete an object successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await expect(deleteObject("obj-1")).resolves.toBeUndefined();
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/objects/obj-1`,
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("getObjectAreas", () => {
    it("should fetch object areas successfully", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [mockArea] }),
      });

      const result = await getObjectAreas("obj-1");

      expect(result).toEqual([mockArea]);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/objects/obj-1/areas`,
        expect.any(Object)
      );
    });
  });

  describe("createObjectArea", () => {
    it("should create an object area successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockArea }),
      } as Response);

      const result = await createObjectArea("obj-1", {
        name: "Terminal 1",
        requires_separate_guard_book: true,
      });

      expect(result).toEqual(mockArea);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/objects/obj-1/areas`,
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  // ============================================================================
  // Object Area Tests
  // ============================================================================

  describe("listObjectAreas", () => {
    it("should list all object areas", async () => {
      const mockResponse: PaginatedResponse<ObjectArea> = {
        data: [mockArea],
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await listObjectAreas();

      expect(result.data).toEqual([mockArea]);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/object-areas`,
        expect.any(Object)
      );
    });

    it("should filter by object_id", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: {} }),
      });

      await listObjectAreas({ object_id: "obj-1" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("object_id=obj-1"),
        expect.any(Object)
      );
    });
  });

  describe("getObjectArea", () => {
    it("should fetch a single object area", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockArea }),
      });

      const result = await getObjectArea("area-1");

      expect(result).toEqual(mockArea);
      expect(mockFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/object-areas/area-1`,
        expect.any(Object)
      );
    });
  });

  describe("updateObjectArea", () => {
    it("should update an object area", async () => {
      const updatedArea = { ...mockArea, name: "Updated Terminal" };
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: updatedArea }),
      } as Response);

      const result = await updateObjectArea("area-1", {
        name: "Updated Terminal",
      });

      expect(result.name).toBe("Updated Terminal");
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/object-areas/area-1`,
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  describe("deleteObjectArea", () => {
    it("should delete an object area", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await expect(deleteObjectArea("area-1")).resolves.toBeUndefined();
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/object-areas/area-1`,
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
