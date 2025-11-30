// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getCustomerDescendants,
  getCustomerAncestors,
  attachCustomerParent,
  detachCustomerParent,
} from "./customerApi";
import { ApiError } from "./secretApi";
import { apiConfig } from "../config";
import type { Customer, PaginatedResponse } from "../types/organizational";

// Mock apiFetch (central API wrapper)
vi.mock("./csrf", () => ({
  apiFetch: vi.fn(),
}));

import { apiFetch } from "./csrf";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetchWithCsrf = apiFetch as any;

describe("Customer API", () => {
  const mockCustomer: Customer = {
    id: "cust-1",
    name: "Rewe Group",
    customer_number: "CUST-001",
    type: "corporate",
    address: "Rewe Straße 1, 50933 Köln",
    contact_email: "info@rewe.de",
    contact_phone: "+49 221 12345",
    metadata: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("listCustomers", () => {
    it("should fetch customers successfully", async () => {
      const mockResponse: PaginatedResponse<Customer> = {
        data: [mockCustomer],
        meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
      };

      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await listCustomers();

      expect(result.data).toEqual([mockCustomer]);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers`,
        expect.objectContaining({ method: "GET" })
      );
    });

    it("should apply filters correctly", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [], meta: {} }),
      });

      await listCustomers({
        type: "regional",
        managed_by: "unit-1",
        per_page: 10,
      });

      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        expect.stringContaining("type=regional"),
        expect.any(Object)
      );
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        expect.stringContaining("managed_by=unit-1"),
        expect.any(Object)
      );
    });

    it("should throw ApiError on failure", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ message: "Forbidden" }),
      });

      await expect(listCustomers()).rejects.toThrow(ApiError);
    });
  });

  describe("getCustomer", () => {
    it("should fetch a single customer successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockCustomer }),
      });

      const result = await getCustomer("cust-1");

      expect(result).toEqual(mockCustomer);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers/cust-1`,
        expect.objectContaining({ method: "GET" })
      );
    });

    it("should throw ApiError when customer not found", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: false,
        status: 404,
        json: async () => ({ message: "Customer not found" }),
      });

      await expect(getCustomer("invalid")).rejects.toThrow(ApiError);
    });
  });

  describe("createCustomer", () => {
    it("should create a customer successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockCustomer }),
      } as Response);

      const result = await createCustomer({
        name: "Rewe Group",
        customer_number: "CUST-001",
        type: "corporate",
      });

      expect(result).toEqual(mockCustomer);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers`,
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("Rewe Group"),
        })
      );
    });

    it("should throw ApiError with validation errors", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: false,
        status: 422,
        json: async () => ({
          message: "Validation failed",
          errors: { customer_number: ["Customer number already exists"] },
        }),
      } as Response);

      try {
        await createCustomer({
          name: "Test",
          customer_number: "CUST-001",
          type: "corporate",
        });
        expect.fail("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).errors).toEqual({
          customer_number: ["Customer number already exists"],
        });
      }
    });
  });

  describe("updateCustomer", () => {
    it("should update a customer successfully", async () => {
      const updatedCustomer = { ...mockCustomer, name: "Rewe International" };
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: updatedCustomer }),
      } as Response);

      const result = await updateCustomer("cust-1", {
        name: "Rewe International",
      });

      expect(result.name).toBe("Rewe International");
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers/cust-1`,
        expect.objectContaining({ method: "PATCH" })
      );
    });
  });

  describe("deleteCustomer", () => {
    it("should delete a customer successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await expect(deleteCustomer("cust-1")).resolves.toBeUndefined();
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers/cust-1`,
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("getCustomerDescendants", () => {
    it("should fetch descendants successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [mockCustomer] }),
      });

      const result = await getCustomerDescendants("cust-1");

      expect(result).toEqual([mockCustomer]);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers/cust-1/descendants`,
        expect.any(Object)
      );
    });
  });

  describe("getCustomerAncestors", () => {
    it("should fetch ancestors successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: [mockCustomer] }),
      });

      const result = await getCustomerAncestors("cust-1");

      expect(result).toEqual([mockCustomer]);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers/cust-1/ancestors`,
        expect.any(Object)
      );
    });
  });

  describe("attachCustomerParent", () => {
    it("should attach parent successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockCustomer }),
      } as Response);

      const result = await attachCustomerParent("cust-1", "parent-cust");

      expect(result).toEqual(mockCustomer);
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers/cust-1/parent`,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ parent_id: "parent-cust" }),
        })
      );
    });
  });

  describe("detachCustomerParent", () => {
    it("should detach parent successfully", async () => {
      mockFetchWithCsrf.mockResolvedValue({
        ok: true,
        json: async () => ({}),
      } as Response);

      await expect(
        detachCustomerParent("cust-1", "parent-cust")
      ).resolves.toBeUndefined();
      expect(mockFetchWithCsrf).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers/cust-1/parent/parent-cust`,
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });
});
