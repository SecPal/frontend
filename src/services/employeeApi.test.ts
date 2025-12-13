// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createEmployee,
  updateEmployee,
  fetchEmployee,
  activateEmployee,
  terminateEmployee,
} from "./employeeApi";
import type { EmployeeFormData } from "./employeeApi";

// Mock the global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("employeeApi - JSON Parsing Error Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful auth check
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ authenticated: true }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("createEmployee", () => {
    it("should throw error when JSON parsing fails on success response", async () => {
      const mockEmployee: EmployeeFormData = {
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        position: "Developer",
        date_of_birth: "1990-01-01",
        contract_start_date: "2025-01-01",
        organizational_unit_id: "unit-1",
        status: "active",
        contract_type: "full_time",
      };

      // Mock response that returns HTML instead of JSON (simulating 500 error page)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: vi.fn().mockRejectedValue(new Error("Unexpected token '<'")),
      });

      await expect(createEmployee(mockEmployee)).rejects.toThrow(
        "API returned status 200 but response has no 'data' field"
      );
    });

    it("should return employee when JSON parsing succeeds", async () => {
      const mockEmployee: EmployeeFormData = {
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        position: "Developer",
        date_of_birth: "1990-01-01",
        contract_start_date: "2025-01-01",
        organizational_unit_id: "unit-1",
        status: "pre_contract",
        contract_type: "full_time",
      };

      const expectedEmployee = {
        id: "emp-1",
        employee_number: "E001",
        ...mockEmployee,
        full_name: "John Doe",
        phone: null,
        organizational_unit: { id: "unit-1", name: "Engineering" },
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map(),
        json: vi.fn().mockResolvedValue({ data: expectedEmployee }),
      });

      const result = await createEmployee(mockEmployee);
      expect(result).toEqual(expectedEmployee);
      expect(result.id).toBe("emp-1");
    });
  });

  describe("updateEmployee", () => {
    it("should throw error when JSON parsing fails on success response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: new Map(),
        json: vi.fn().mockRejectedValue(new Error("Unexpected token '<'")),
      });

      await expect(
        updateEmployee("emp-1", { first_name: "Jane" })
      ).rejects.toThrow("Failed to parse employee response");
    });

    it("should return updated employee when JSON parsing succeeds", async () => {
      const expectedEmployee = {
        id: "emp-1",
        employee_number: "E001",
        first_name: "Jane",
        last_name: "Doe",
        full_name: "Jane Doe",
        email: "jane@example.com",
        position: "Developer",
        date_of_birth: "1990-01-01",
        contract_start_date: "2025-01-01",
        status: "active" as const,
        phone: null,
        organizational_unit: { id: "unit-1", name: "Engineering" },
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: expectedEmployee }),
      });

      const result = await updateEmployee("emp-1", { first_name: "Jane" });
      expect(result.first_name).toBe("Jane");
    });
  });

  describe("fetchEmployee", () => {
    it("should throw error when JSON parsing fails on success response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error("Unexpected token '<'")),
      });

      await expect(fetchEmployee("emp-1")).rejects.toThrow(
        "Failed to parse employee response"
      );
    });
  });

  describe("activateEmployee", () => {
    it("should throw error when JSON parsing fails on success response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error("Unexpected token '<'")),
      });

      await expect(activateEmployee("emp-1")).rejects.toThrow(
        "Failed to parse employee response"
      );
    });
  });

  describe("terminateEmployee", () => {
    it("should throw error when JSON parsing fails on success response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error("Unexpected token '<'")),
      });

      await expect(terminateEmployee("emp-1")).rejects.toThrow(
        "Failed to parse employee response"
      );
    });
  });

  describe("Error response handling", () => {
    it("should handle error responses with JSON parsing failure", async () => {
      const mockEmployee: EmployeeFormData = {
        first_name: "John",
        last_name: "Doe",
        email: "john@example.com",
        position: "Developer",
        date_of_birth: "1990-01-01",
        contract_start_date: "2025-01-01",
        organizational_unit_id: "unit-1",
        status: "pre_contract",
        contract_type: "full_time",
      };

      // Mock 500 error with HTML response
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        json: vi.fn().mockRejectedValue(new Error("Unexpected token '<'")),
      });

      await expect(createEmployee(mockEmployee)).rejects.toThrow(
        "Internal Server Error"
      );
    });
  });
});
