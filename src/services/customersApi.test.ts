// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "./customersApi";
import * as csrf from "./csrf";
import { apiConfig } from "../config";

// Mock the csrf module
vi.mock("./csrf");

describe("customersApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCustomers", () => {
    it("fetches customers list successfully", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [
            {
              id: "customer-1",
              name: "Customer 1",
              billing_address: {
                street: "Street 1",
                city: "City 1",
                postal_code: "12345",
                country: "DE",
              },
              is_active: true,
              created_at: "2025-01-01T00:00:00Z",
              updated_at: "2025-01-01T00:00:00Z",
            },
            {
              id: "customer-2",
              name: "Customer 2",
              billing_address: {
                street: "Street 2",
                city: "City 2",
                postal_code: "54321",
                country: "AT",
              },
              is_active: true,
              created_at: "2025-01-02T00:00:00Z",
              updated_at: "2025-01-02T00:00:00Z",
            },
          ],
          meta: {
            current_page: 1,
            total: 2,
          },
        }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      const result = await listCustomers();

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers?`
      );
      expect(result.data).toHaveLength(2);
      expect(result.data[0]?.name).toBe("Customer 1");
      expect(result.data[1]?.name).toBe("Customer 2");
      expect(result.meta.total).toBe(2);
    });

    it("fetches customers with filters", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [] }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      await listCustomers({
        search: "test",
        is_active: true,
        page: 2,
        per_page: 20,
      });

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers?search=test&is_active=1&page=2&per_page=20`
      );
    });

    it("handles API errors", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ message: "Internal server error" }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      await expect(listCustomers()).rejects.toThrow("Internal server error");
    });
  });

  describe("getCustomer", () => {
    it("fetches single customer successfully", async () => {
      const mockCustomer = {
        id: "customer-123",
        name: "Test Customer",
        billing_address: {
          street: "Test Street 1",
          city: "Test City",
          postal_code: "12345",
          country: "DE",
        },
        contact: {
          name: "John Doe",
          email: "john@example.com",
          phone: "+49 123 456789",
        },
        is_active: true,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: mockCustomer }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      const result = await getCustomer("customer-123");

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers/customer-123`
      );
      expect(result).toEqual(mockCustomer);
    });

    it("handles 404 not found", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ message: "Customer not found" }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      await expect(getCustomer("nonexistent")).rejects.toThrow(
        "Customer not found"
      );
    });
  });

  describe("createCustomer", () => {
    it("creates customer successfully", async () => {
      const customerData = {
        name: "New Customer",
        billing_address: {
          street: "New Street 1",
          city: "New City",
          postal_code: "12345",
          country: "DE",
        },
        is_active: true,
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            id: "customer-new",
            ...customerData,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      const result = await createCustomer(customerData);

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(customerData),
        }
      );

      expect(result.id).toBe("customer-new");
      expect(result.name).toBe("New Customer");
    });

    it("handles validation errors", async () => {
      const mockResponse = {
        ok: false,
        status: 422,
        json: vi.fn().mockResolvedValue({
          message: "Validation failed",
          errors: {
            name: ["The name field is required."],
            "billing_address.street": ["The billing street field is required."],
          },
        }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      await expect(
        createCustomer({
          name: "",
          billing_address: {
            street: "",
            city: "",
            postal_code: "",
            country: "",
          },
        })
      ).rejects.toThrow(/name: The name field is required/);
    });

    it("sends Content-Type header", async () => {
      const customerData = {
        name: "Test",
        billing_address: {
          street: "Street",
          city: "City",
          postal_code: "12345",
          country: "DE",
        },
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: { id: "test", ...customerData },
        }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      await createCustomer(customerData);

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  describe("updateCustomer", () => {
    it("updates customer successfully", async () => {
      const updateData = {
        name: "Updated Customer",
        is_active: false,
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            id: "customer-123",
            ...updateData,
            billing_address: {
              street: "Street",
              city: "City",
              postal_code: "12345",
              country: "DE",
            },
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-02T00:00:00Z",
          },
        }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      const result = await updateCustomer("customer-123", updateData);

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers/customer-123`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(updateData),
        }
      );

      expect(result.name).toBe("Updated Customer");
      expect(result.is_active).toBe(false);
    });

    it("updates partial fields", async () => {
      const updateData = {
        notes: "New notes only",
      };

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            id: "customer-123",
            name: "Existing Name",
            billing_address: {
              street: "Street",
              city: "City",
              postal_code: "12345",
              country: "DE",
            },
            notes: "New notes only",
            is_active: true,
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-02T00:00:00Z",
          },
        }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      const result = await updateCustomer("customer-123", updateData);

      expect(result.notes).toBe("New notes only");
    });

    it("handles validation errors", async () => {
      const mockResponse = {
        ok: false,
        status: 422,
        json: vi.fn().mockResolvedValue({
          message: "Validation failed",
          errors: {
            "billing_address.country": ["The country must be 2 characters."],
          },
        }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      await expect(
        updateCustomer("customer-123", {
          billing_address: {
            street: "Street",
            city: "City",
            postal_code: "12345",
            country: "GERMANY", // Too long
          },
        })
      ).rejects.toThrow(/country must be 2 characters/);
    });

    it("sends Content-Type header", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: {
            id: "customer-123",
            name: "Test",
            billing_address: {
              street: "Street",
              city: "City",
              postal_code: "12345",
              country: "DE",
            },
          },
        }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      await updateCustomer("customer-123", { name: "Test" });

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
          }),
        })
      );
    });
  });

  describe("deleteCustomer", () => {
    it("deletes customer successfully", async () => {
      const mockResponse = {
        ok: true,
        status: 204,
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      await deleteCustomer("customer-123");

      expect(csrf.apiFetch).toHaveBeenCalledWith(
        `${apiConfig.baseUrl}/v1/customers/customer-123`,
        {
          method: "DELETE",
        }
      );
    });

    it("handles 404 not found", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        json: vi.fn().mockResolvedValue({ message: "Customer not found" }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      await expect(deleteCustomer("nonexistent")).rejects.toThrow();
    });

    it("handles deletion with active sites", async () => {
      const mockResponse = {
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({
          message: "Cannot delete customer with active sites",
        }),
      };

      vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

      await expect(deleteCustomer("customer-123")).rejects.toThrow(
        "Cannot delete customer with active sites"
      );
    });
  });
});
