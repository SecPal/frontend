// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { EmployeeCreate } from "./EmployeeCreate";
import * as employeeApi from "../../services/employeeApi";
import * as organizationalUnitApi from "../../services/organizationalUnitApi";

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

// Helper to render with all required providers
const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{component}</MemoryRouter>
    </I18nProvider>
  );
};

const mockOrganizationalUnits = [
  {
    id: "unit-1",
    name: "Main Office",
    type: "branch" as const,
    parent: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "unit-2",
    name: "Remote Team",
    type: "branch" as const,
    parent: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

describe("EmployeeCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock organizational units loading
    vi.mocked(organizationalUnitApi.listOrganizationalUnits).mockResolvedValue({
      data: mockOrganizationalUnits,
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: 2,
        root_unit_ids: ["unit-1", "unit-2"],
      },
    });
  });

  it("should render create form with all fields", async () => {
    renderWithProviders(<EmployeeCreate />);

    await waitFor(() => {
      expect(screen.getByText(/create new employee/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/date of birth/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/position/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contract start date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/organizational unit/i)).toBeInTheDocument();
  });

  it("should load organizational units on mount", async () => {
    renderWithProviders(<EmployeeCreate />);

    await waitFor(() => {
      expect(organizationalUnitApi.listOrganizationalUnits).toHaveBeenCalled();
    });

    await waitFor(() => {
      const select = screen.getByLabelText(/organizational unit/i);
      expect(select).toBeInTheDocument();
      expect(screen.getByText("Main Office")).toBeInTheDocument();
      expect(screen.getByText("Remote Team")).toBeInTheDocument();
    });
  });

  it("should create employee and navigate on success", async () => {
    const mockCreateEmployee = vi.mocked(employeeApi.createEmployee);
    mockCreateEmployee.mockResolvedValue({
      id: "emp-123",
      employee_number: "EMP001",
      first_name: "John",
      last_name: "Doe",
      full_name: "John Doe",
      email: "john.doe@example.com",
      phone: "+1234567890",
      date_of_birth: "1990-01-01",
      hire_date: "2025-01-01",
      contract_start_date: "2025-01-01",
      contract_end_date: undefined,
      position: "Developer",
      status: "active",
      contract_type: "full_time",
      organizational_unit: {
        id: "unit-1",
        name: "Main Office",
      },
      user: undefined,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    });

    renderWithProviders(<EmployeeCreate />);

    // Wait for organizational units to load
    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Fill in form
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "john.doe@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: "+1234567890" },
    });
    fireEvent.change(screen.getByLabelText(/date of birth/i), {
      target: { value: "1990-01-01" },
    });
    fireEvent.change(screen.getByLabelText(/position/i), {
      target: { value: "Developer" },
    });
    fireEvent.change(screen.getByLabelText(/contract start date/i), {
      target: { value: "2025-01-01" },
    });
    fireEvent.change(screen.getByLabelText(/organizational unit/i), {
      target: { value: "unit-1" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /create employee/i }));

    await waitFor(() => {
      expect(mockCreateEmployee).toHaveBeenCalledWith({
        first_name: "John",
        last_name: "Doe",
        email: "john.doe@example.com",
        phone: "+1234567890",
        date_of_birth: "1990-01-01",
        position: "Developer",
        contract_start_date: "2025-01-01",
        organizational_unit_id: "unit-1",
        status: "pre_contract",
        contract_type: "full_time",
      });
    });

    expect(mockNavigate).toHaveBeenCalledWith("/employees/emp-123");
  });

  it("should display error on create failure", async () => {
    const mockCreateEmployee = vi.mocked(employeeApi.createEmployee);
    mockCreateEmployee.mockRejectedValue(new Error("Server error"));

    renderWithProviders(<EmployeeCreate />);

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Fill in minimal required fields
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "john.doe@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/date of birth/i), {
      target: { value: "1990-01-01" },
    });
    fireEvent.change(screen.getByLabelText(/position/i), {
      target: { value: "Developer" },
    });
    fireEvent.change(screen.getByLabelText(/contract start date/i), {
      target: { value: "2025-01-01" },
    });
    fireEvent.change(screen.getByLabelText(/organizational unit/i), {
      target: { value: "unit-1" },
    });

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /create employee/i }));

    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("should navigate back to employees on cancel", async () => {
    renderWithProviders(<EmployeeCreate />);

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/employees");
  });

  it("should show loading state for organizational units", () => {
    vi.mocked(organizationalUnitApi.listOrganizationalUnits).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders(<EmployeeCreate />);

    const select = screen.getByLabelText(/organizational unit/i);
    expect(select).toBeDisabled();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("should handle organizational units loading error gracefully", async () => {
    vi.mocked(organizationalUnitApi.listOrganizationalUnits).mockRejectedValue(
      new Error("Failed to load units")
    );

    renderWithProviders(<EmployeeCreate />);

    await waitFor(() => {
      const select = screen.getByLabelText(/organizational unit/i);
      expect(select).not.toBeDisabled();
    });

    // Should still render form, just without units
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
  });

  it("should handle non-Error object errors", async () => {
    const mockCreateEmployee = vi.mocked(employeeApi.createEmployee);
    mockCreateEmployee.mockRejectedValue({ message: "Custom error object" });

    renderWithProviders(<EmployeeCreate />);

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Fill minimal fields
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "test@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/date of birth/i), {
      target: { value: "1990-01-01" },
    });
    fireEvent.change(screen.getByLabelText(/position/i), {
      target: { value: "Developer" },
    });
    fireEvent.change(screen.getByLabelText(/contract start date/i), {
      target: { value: "2025-01-01" },
    });
    fireEvent.change(screen.getByLabelText(/organizational unit/i), {
      target: { value: "unit-1" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create employee/i }));

    await waitFor(() => {
      expect(screen.getByText(/custom error object/i)).toBeInTheDocument();
    });
  });

  it("should allow changing status and contract type fields", async () => {
    renderWithProviders(<EmployeeCreate />);

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Change status
    const statusSelect = screen.getByLabelText(/status/i);
    fireEvent.change(statusSelect, { target: { value: "active" } });
    expect(statusSelect).toHaveValue("active");

    // Change contract type
    const contractTypeSelect = screen.getByLabelText(/contract type/i);
    fireEvent.change(contractTypeSelect, { target: { value: "part_time" } });
    expect(contractTypeSelect).toHaveValue("part_time");
  });
});
