// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { EmployeeFormData } from "@/types/api";
import {
  createEmployee,
  updateEmployee,
  fetchEmployee,
  activateEmployee,
  confirmEmployeeOnboarding,
  terminateEmployee,
} from "./employeeApi";

type IsOptional<T, K extends keyof T> =
  Record<never, never> extends Pick<T, K> ? true : false;

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
    it("should keep contract-required employee create fields mandatory in the type", () => {
      const dateOfBirthIsOptional: IsOptional<
        EmployeeFormData,
        "date_of_birth"
      > = false;
      const positionIsOptional: IsOptional<EmployeeFormData, "position"> =
        false;
      const contractStartDateIsOptional: IsOptional<
        EmployeeFormData,
        "contract_start_date"
      > = false;
      const organizationalUnitIdIsOptional: IsOptional<
        EmployeeFormData,
        "organizational_unit_id"
      > = false;

      expect(dateOfBirthIsOptional).toBe(false);
      expect(positionIsOptional).toBe(false);
      expect(contractStartDateIsOptional).toBe(false);
      expect(organizationalUnitIdIsOptional).toBe(false);
    });

    it("should omit management_level from the create payload for non-leadership employees", async () => {
      const mockEmployee: EmployeeFormData = {
        first_name: "John",
        last_name: "Doe",
        email: "john@secpal.dev",
        position: "Security Guard",
        date_of_birth: "1990-01-01",
        contract_start_date: "2025-01-01",
        organizational_unit_id: "unit-1",
        status: "pre_contract",
        contract_type: "full_time",
        management_level: 0,
        send_invitation: true,
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 201,
        headers: new Map(),
        json: vi.fn().mockResolvedValue({
          data: {
            id: "emp-1",
            employee_number: "E001",
            ...mockEmployee,
            full_name: "John Doe",
            phone: null,
            organizational_unit: { id: "unit-1", name: "Engineering" },
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
            onboarding_invitation: {
              status: "sent",
              requested_at: "2025-01-01T00:00:00Z",
              token_created_at: "2025-01-01T00:00:00Z",
              mail_sent_at: "2025-01-01T00:00:01Z",
              mail_failed_at: null,
              failure_reason: null,
            },
          },
        }),
      });

      await createEmployee(mockEmployee);

      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining("/v1/employees"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            first_name: "John",
            last_name: "Doe",
            email: "john@secpal.dev",
            position: "Security Guard",
            date_of_birth: "1990-01-01",
            contract_start_date: "2025-01-01",
            organizational_unit_id: "unit-1",
            status: "pre_contract",
            contract_type: "full_time",
            send_invitation: true,
          }),
        })
      );
    });

    it("should throw error when JSON parsing fails on success response", async () => {
      const mockEmployee: EmployeeFormData = {
        first_name: "John",
        last_name: "Doe",
        email: "john@secpal.dev",
        position: "Developer",
        date_of_birth: "1990-01-01",
        contract_start_date: "2025-01-01",
        organizational_unit_id: "unit-1",
        status: "active",
        contract_type: "full_time",
        management_level: 0,
        send_invitation: false,
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
        email: "john@secpal.dev",
        position: "Developer",
        date_of_birth: "1990-01-01",
        contract_start_date: "2025-01-01",
        organizational_unit_id: "unit-1",
        status: "pre_contract",
        contract_type: "full_time",
        management_level: 0,
        send_invitation: true,
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
        onboarding_invitation: {
          status: "sent",
          requested_at: "2025-01-01T00:00:00Z",
          token_created_at: "2025-01-01T00:00:00Z",
          mail_sent_at: "2025-01-01T00:00:01Z",
          mail_failed_at: null,
          failure_reason: null,
        },
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
        email: "jane@secpal.dev",
        position: "Developer",
        date_of_birth: "1990-01-01",
        contract_start_date: "2025-01-01",
        status: "active" as const,
        contract_type: "full_time" as const,
        management_level: 0,
        phone: null,
        organizational_unit: { id: "unit-1", name: "Engineering" },
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
        onboarding_invitation: {
          status: "not_requested" as const,
          requested_at: null,
          token_created_at: null,
          mail_sent_at: null,
          mail_failed_at: null,
          failure_reason: null,
        },
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

  describe("confirmEmployeeOnboarding", () => {
    it("should post the onboarding confirmation action and return the updated employee", async () => {
      const expectedEmployee = {
        id: "emp-1",
        employee_number: "E001",
        first_name: "Jane",
        last_name: "Doe",
        full_name: "Jane Doe",
        email: "jane@secpal.dev",
        position: "Developer",
        date_of_birth: "1990-01-01",
        contract_start_date: "2025-01-01",
        status: "pre_contract" as const,
        contract_type: "full_time" as const,
        management_level: 0,
        phone: null,
        organizational_unit: { id: "unit-1", name: "Engineering" },
        onboarding_completed: true,
        onboarding_workflow: {
          status: "ready_for_activation" as const,
        },
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: expectedEmployee }),
      });

      const result = await confirmEmployeeOnboarding("emp-1", {
        notes: "Contract signed and reviewed.",
      });

      expect(result.onboarding_workflow?.status).toBe("ready_for_activation");
      expect(mockFetch).toHaveBeenLastCalledWith(
        expect.stringContaining("/v1/admin/onboarding/employees/emp-1/confirm"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ notes: "Contract signed and reviewed." }),
        })
      );
    });

    it("should throw an error when the confirmation success response cannot be parsed", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new Error("Unexpected token '<'")),
      });

      await expect(confirmEmployeeOnboarding("emp-1")).rejects.toThrow(
        "Failed to parse employee response"
      );
    });

    it("should fall back to statusText when the confirmation error body is not JSON", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        json: vi.fn().mockRejectedValue(new Error("Unexpected token '<'")),
      });

      await expect(confirmEmployeeOnboarding("emp-1")).rejects.toThrow(
        "Bad Gateway"
      );
    });
  });

  describe("Error response handling", () => {
    it("should handle error responses with JSON parsing failure", async () => {
      const mockEmployee: EmployeeFormData = {
        first_name: "John",
        last_name: "Doe",
        email: "john@secpal.dev",
        position: "Developer",
        date_of_birth: "1990-01-01",
        contract_start_date: "2025-01-01",
        organizational_unit_id: "unit-1",
        status: "pre_contract",
        contract_type: "full_time",
        management_level: 0,
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
