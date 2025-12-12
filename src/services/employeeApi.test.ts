// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchEmployees,
  fetchEmployee,
  createEmployee,
  activateEmployee,
  terminateEmployee,
  type EmployeeFormData,
} from "./employeeApi";
import * as csrf from "./csrf";

// Mock apiFetch
vi.mock("./csrf", () => ({
  apiFetch: vi.fn(),
}));

describe("employeeApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchEmployees", () => {
    it("should fetch employees with filters", async () => {
      const mockResponse = {
        data: [
          {
            id: "1",
            employee_number: "E001",
            first_name: "John",
            last_name: "Doe",
            full_name: "John Doe",
            email: "john@example.com",
            status: "active",
            position: "Security Guard",
            organizational_unit: { id: "1", name: "Unit A" },
            created_at: "2025-01-01T00:00:00Z",
            updated_at: "2025-01-01T00:00:00Z",
          },
        ],
        meta: {
          current_page: 1,
          per_page: 15,
          total: 1,
          last_page: 1,
        },
      };

      vi.mocked(csrf.apiFetch).mockResolvedValueOnce(mockResponse);

      const result = await fetchEmployees({ status: "active", page: 1 });

      expect(result).toEqual(mockResponse);
      expect(csrf.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/employees?status=active&page=1"),
        expect.objectContaining({ method: "GET" })
      );
    });
  });

  describe("createEmployee", () => {
    it("should create a new employee", async () => {
      const formData: EmployeeFormData = {
        first_name: "Jane",
        last_name: "Smith",
        email: "jane@example.com",
        date_of_birth: "1990-01-01",
        position: "Supervisor",
        contract_start_date: "2025-02-01",
        organizational_unit_id: "1",
      };

      const mockResponse = {
        id: "2",
        employee_number: "E002",
        ...formData,
        full_name: "Jane Smith",
        status: "pre_contract",
        organizational_unit: { id: "1", name: "Unit A" },
        created_at: "2025-01-15T00:00:00Z",
        updated_at: "2025-01-15T00:00:00Z",
      };

      vi.mocked(csrf.apiFetch).mockResolvedValueOnce(mockResponse);

      const result = await createEmployee(formData);

      expect(result).toEqual(mockResponse);
      expect(csrf.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining("/employees"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(formData),
        })
      );
    });
  });

  describe("activateEmployee", () => {
    it("should activate an employee", async () => {
      const employeeId = "1";
      const mockResponse = {
        id: employeeId,
        status: "active",
      };

      vi.mocked(csrf.apiFetch).mockResolvedValueOnce(mockResponse);

      const result = await activateEmployee(employeeId);

      expect(result).toEqual(mockResponse);
      expect(csrf.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/employees/${employeeId}/activate`),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  describe("terminateEmployee", () => {
    it("should terminate an employee", async () => {
      const employeeId = "1";
      const mockResponse = {
        id: employeeId,
        status: "terminated",
      };

      vi.mocked(csrf.apiFetch).mockResolvedValueOnce(mockResponse);

      const result = await terminateEmployee(employeeId);

      expect(result).toEqual(mockResponse);
      expect(csrf.apiFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/employees/${employeeId}/terminate`),
        expect.objectContaining({ method: "POST" })
      );
    });
  });
});
