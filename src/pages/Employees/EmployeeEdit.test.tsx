// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { EmployeeEdit } from "./EmployeeEdit";
import * as employeeApi from "../../services/employeeApi";
import * as organizationalUnitApi from "../../services/organizationalUnitApi";
import type { Employee } from "../../services/employeeApi";

// Mock the API modules
vi.mock("../../services/employeeApi");
vi.mock("../../services/organizationalUnitApi");

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Helper to render with all required providers and route parameter
const renderWithProviders = (employeeId: string) => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[`/employees/${employeeId}/edit`]}>
        <Routes>
          <Route path="/employees/:id/edit" element={<EmployeeEdit />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
};

const mockEmployee: Employee = {
  id: "emp-1",
  employee_number: "E001",
  first_name: "John",
  last_name: "Doe",
  full_name: "John Doe",
  email: "john.doe@example.com",
  phone: "+1234567890",
  date_of_birth: "1990-01-01",
  position: "Developer",
  contract_start_date: "2025-01-01",
  status: "active",
  contract_type: "full_time",
  organizational_unit: {
    id: "unit-1",
    name: "Engineering",
  },
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const mockOrganizationalUnits = [
  {
    id: "unit-1",
    name: "Engineering",
    type: "branch" as const,
    parent: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "unit-2",
    name: "Marketing",
    type: "branch" as const,
    parent: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

describe("EmployeeEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(mockEmployee);
    vi.mocked(organizationalUnitApi.listOrganizationalUnits).mockResolvedValue({
      data: mockOrganizationalUnits,
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 50,
        total: 2,
        root_unit_ids: [],
      },
    });
  });

  it("should load and pre-populate form with employee data", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    expect(screen.getByLabelText(/last name/i)).toHaveValue("Doe");
    expect(screen.getByLabelText(/email/i)).toHaveValue("john.doe@example.com");
    expect(screen.getByLabelText(/phone/i)).toHaveValue("+1234567890");
    expect(screen.getByLabelText(/position/i)).toHaveValue("Developer");
    expect(screen.getByLabelText(/date of birth/i)).toHaveValue("1990-01-01");
    expect(screen.getByLabelText(/contract start date/i)).toHaveValue(
      "2025-01-01"
    );
  });

  it("should load organizational units into dropdown", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByText("Engineering")).toBeInTheDocument();
    });

    expect(screen.getByText("Marketing")).toBeInTheDocument();
  });

  it("should display error on fetch failure", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockRejectedValue(
      new Error("Employee not found")
    );

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /error/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/employee not found/i)).toBeInTheDocument();
    });
  });

  it("should update employee and navigate on success", async () => {
    const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
    mockUpdateEmployee.mockResolvedValue({
      ...mockEmployee,
      first_name: "Jane",
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    // Update first name
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Jane" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateEmployee).toHaveBeenCalledWith("emp-1", {
        first_name: "Jane",
        last_name: "Doe",
        email: "john.doe@example.com",
        phone: "+1234567890",
        date_of_birth: "1990-01-01",
        position: "Developer",
        contract_start_date: "2025-01-01",
        organizational_unit_id: "unit-1",
        status: "active",
        contract_type: "full_time",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/employees/emp-1");
  });

  it("should display error on update failure", async () => {
    const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
    mockUpdateEmployee.mockRejectedValue(new Error("Update failed"));

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /error/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/update failed/i)).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should navigate back to detail on cancel", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    const cancelButton = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelButton);

    expect(mockNavigate).toHaveBeenCalledWith("/employees/emp-1");
  });

  it("should handle organizational unit change", async () => {
    const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
    mockUpdateEmployee.mockResolvedValue({
      ...mockEmployee,
      organizational_unit: { id: "unit-2", name: "Marketing" },
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    // Change organizational unit
    const orgUnitSelect = screen.getByLabelText(/organizational unit/i);
    fireEvent.change(orgUnitSelect, { target: { value: "unit-2" } });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateEmployee).toHaveBeenCalledWith(
        "emp-1",
        expect.objectContaining({
          organizational_unit_id: "unit-2",
        })
      );
    });
  });

  it("should show loading state while fetching employee", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders("emp-1");

    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Cleanup to avoid memory leaks
    await waitFor(() => {}, { timeout: 100 }).catch(() => {});
  });

  it("should show loading state for organizational units", async () => {
    vi.mocked(organizationalUnitApi.listOrganizationalUnits).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    const orgUnitSelect = screen.getByLabelText(/organizational unit/i);
    expect(orgUnitSelect).toHaveTextContent(/loading/i);
  });

  it("should handle non-Error object errors on fetch", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockRejectedValue({
      message: "Custom fetch error",
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByText(/custom fetch error/i)).toBeInTheDocument();
    });
  });

  it("should handle non-Error object errors on update", async () => {
    vi.mocked(employeeApi.updateEmployee).mockRejectedValue({
      message: "Custom update error",
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "Jane" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(screen.getByText(/custom update error/i)).toBeInTheDocument();
    });
  });

  it("should handle organizational units loading error", async () => {
    vi.mocked(organizationalUnitApi.listOrganizationalUnits).mockRejectedValue(
      new Error("Failed to load units")
    );

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    // Should still be able to edit other fields
    expect(screen.getByLabelText(/first name/i)).not.toBeDisabled();
  });
});
