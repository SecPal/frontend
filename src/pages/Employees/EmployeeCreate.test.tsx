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
    expect(screen.getAllByLabelText(/position/i)[0]).toBeInTheDocument();
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
      management_level: 0,
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
    fireEvent.change(screen.getByLabelText("Position *"), {
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
        date_of_birth: "",
        position: "Developer",
        contract_start_date: "",
        organizational_unit_id: "unit-1",
        management_level: 0,
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
    fireEvent.change(screen.getByLabelText("Position *"), {
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
    const loadingText = screen.getByText(/loading/i);
    expect(loadingText).toBeInTheDocument();
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
    fireEvent.change(screen.getByLabelText("Position *"), {
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

  it("should clear error message when user changes input", async () => {
    vi.mocked(organizationalUnitApi.listOrganizationalUnits).mockResolvedValue({
      data: mockOrganizationalUnits,
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: mockOrganizationalUnits.length,
        root_unit_ids: ["unit-1", "unit-2"],
      },
    });
    vi.mocked(employeeApi.createEmployee).mockRejectedValue(
      new Error("Validation error: email already exists")
    );

    renderWithProviders(<EmployeeCreate />);

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Fill form and trigger error
    fireEvent.change(screen.getByLabelText(/first name/i), {
      target: { value: "John" },
    });
    fireEvent.change(screen.getByLabelText(/last name/i), {
      target: { value: "Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "duplicate@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/date of birth/i), {
      target: { value: "1990-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Position *"), {
      target: { value: "Developer" },
    });
    fireEvent.change(screen.getByLabelText(/contract start date/i), {
      target: { value: "2025-01-01" },
    });
    fireEvent.change(screen.getByLabelText(/organizational unit/i), {
      target: { value: "unit-1" },
    });

    // Submit form to trigger error
    fireEvent.click(screen.getByRole("button", { name: /create employee/i }));

    // Verify error is displayed
    await waitFor(() => {
      expect(
        screen.getByText(/validation error: email already exists/i)
      ).toBeInTheDocument();
    });

    // Change any input field
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "new@example.com" },
    });

    // Verify error is cleared
    await waitFor(() => {
      expect(
        screen.queryByText(/validation error: email already exists/i)
      ).not.toBeInTheDocument();
    });
  });

  describe("Management Level Functionality", () => {
    it("should toggle leadership position switch", async () => {
      renderWithProviders(<EmployeeCreate />);

      await waitFor(() => {
        expect(screen.getByText("Main Office")).toBeInTheDocument();
      });

      const leadershipSwitch = screen.getByRole("switch");
      expect(leadershipSwitch).not.toBeChecked();

      // Enable leadership
      fireEvent.click(leadershipSwitch);
      expect(leadershipSwitch).toBeChecked();

      // Verify management level input is now enabled
      const managementLevelInput = screen.getByRole("spinbutton");
      expect(managementLevelInput).not.toBeDisabled();
    });

    it("should disable and clear management level when leadership is turned off", async () => {
      renderWithProviders(<EmployeeCreate />);

      await waitFor(() => {
        expect(screen.getByText("Main Office")).toBeInTheDocument();
      });

      const leadershipSwitch = screen.getByRole("switch");

      // Enable leadership and set management level
      fireEvent.click(leadershipSwitch);

      const managementLevelInput = screen.getByRole("spinbutton");
      fireEvent.change(managementLevelInput, { target: { value: "5" } });
      expect(managementLevelInput).toHaveValue(5);

      // Disable leadership
      fireEvent.click(leadershipSwitch);

      // Verify management level is reset to 0 and input is disabled
      expect(managementLevelInput).toBeDisabled();
      expect(managementLevelInput).toHaveValue(null);
    });

    it("should accept valid management level values (1-255)", async () => {
      renderWithProviders(<EmployeeCreate />);

      await waitFor(() => {
        expect(screen.getByText("Main Office")).toBeInTheDocument();
      });

      // Enable leadership
      const leadershipSwitch = screen.getByRole("switch");
      fireEvent.click(leadershipSwitch);

      const managementLevelInput = screen.getByRole("spinbutton");

      // Test minimum value
      fireEvent.change(managementLevelInput, { target: { value: "1" } });
      expect(managementLevelInput).toHaveValue(1);

      // Test maximum value
      fireEvent.change(managementLevelInput, { target: { value: "255" } });
      expect(managementLevelInput).toHaveValue(255);

      // Test middle value
      fireEvent.change(managementLevelInput, { target: { value: "50" } });
      expect(managementLevelInput).toHaveValue(50);
    });

    it("should include management_level in form submission", async () => {
      const mockCreateEmployee = vi.mocked(employeeApi.createEmployee);
      mockCreateEmployee.mockResolvedValue({
        id: "emp-123",
        employee_number: "EMP001",
        first_name: "John",
        last_name: "Doe",
        full_name: "John Doe",
        email: "john@example.com",
        phone: "",
        date_of_birth: "1990-01-01",
        hire_date: "2025-01-01",
        contract_start_date: "2025-01-01",
        contract_end_date: undefined,
        position: "CEO",
        status: "active",
        contract_type: "full_time",
        management_level: 1,
        organizational_unit: {
          id: "unit-1",
          name: "Main Office",
        },
        user: undefined,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      });

      renderWithProviders(<EmployeeCreate />);

      await waitFor(() => {
        expect(screen.getByText("Main Office")).toBeInTheDocument();
      });

      // Fill form with leadership position
      fireEvent.change(screen.getByLabelText(/first name/i), {
        target: { value: "John" },
      });
      fireEvent.change(screen.getByLabelText(/last name/i), {
        target: { value: "Doe" },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "john@example.com" },
      });
      fireEvent.change(screen.getByLabelText(/date of birth/i), {
        target: { value: "1990-01-01" },
      });
      fireEvent.change(screen.getByLabelText("Position *"), {
        target: { value: "CEO" },
      });
      fireEvent.change(screen.getByLabelText(/contract start date/i), {
        target: { value: "2025-01-01" },
      });
      fireEvent.change(screen.getByLabelText(/organizational unit/i), {
        target: { value: "unit-1" },
      });

      // Enable leadership and set management level
      const leadershipSwitch = screen.getByRole("switch");
      fireEvent.click(leadershipSwitch);

      const managementLevelInput = screen.getByRole("spinbutton");
      fireEvent.change(managementLevelInput, { target: { value: "1" } });

      // Submit
      fireEvent.click(screen.getByRole("button", { name: /create employee/i }));

      await waitFor(() => {
        expect(mockCreateEmployee).toHaveBeenCalledWith(
          expect.objectContaining({
            management_level: 1,
          })
        );
      });
    });
  });

  describe("Date Validation", () => {
    it("should validate birth date format on blur (US format)", async () => {
      renderWithProviders(<EmployeeCreate />);

      await waitFor(() => {
        expect(screen.getByText("Main Office")).toBeInTheDocument();
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);

      // Enter invalid date
      fireEvent.change(birthDateInput, { target: { value: "13/32/2020" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(
          screen.getByText(/invalid date.*mm\/dd\/yyyy/i)
        ).toBeInTheDocument();
      });
    });

    it("should accept valid US date format", async () => {
      renderWithProviders(<EmployeeCreate />);

      await waitFor(() => {
        expect(screen.getByText("Main Office")).toBeInTheDocument();
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);

      // Enter valid date
      fireEvent.change(birthDateInput, { target: { value: "01/15/1990" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(birthDateInput).toHaveValue("01/15/1990");
        expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
      });
    });

    it("should validate contract start date format", async () => {
      renderWithProviders(<EmployeeCreate />);

      await waitFor(() => {
        expect(screen.getByText("Main Office")).toBeInTheDocument();
      });

      const contractDateInput = screen.getByLabelText(/contract start date/i);

      // Enter invalid date
      fireEvent.change(contractDateInput, { target: { value: "99/99/9999" } });
      fireEvent.blur(contractDateInput);

      await waitFor(() => {
        expect(
          screen.getByText(/invalid date.*mm\/dd\/yyyy/i)
        ).toBeInTheDocument();
      });
    });

    it("should clear date validation error on change", async () => {
      renderWithProviders(<EmployeeCreate />);

      await waitFor(() => {
        expect(screen.getByText("Main Office")).toBeInTheDocument();
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);

      // Enter invalid date and trigger error
      fireEvent.change(birthDateInput, { target: { value: "invalid" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(screen.getByText(/invalid date/i)).toBeInTheDocument();
      });

      // Change input again - error should clear
      fireEvent.change(birthDateInput, { target: { value: "01/01/1990" } });

      await waitFor(() => {
        expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
      });
    });

    it("should reject dates with year outside 1900-2100 range", async () => {
      renderWithProviders(<EmployeeCreate />);

      await waitFor(() => {
        expect(screen.getByText("Main Office")).toBeInTheDocument();
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);

      // Test year too early
      fireEvent.change(birthDateInput, { target: { value: "01/01/1899" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(screen.getByText(/invalid date/i)).toBeInTheDocument();
      });

      // Test year too late
      fireEvent.change(birthDateInput, { target: { value: "01/01/2101" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(screen.getByText(/invalid date/i)).toBeInTheDocument();
      });
    });

    it("should reject invalid day/month combinations", async () => {
      renderWithProviders(<EmployeeCreate />);

      await waitFor(() => {
        expect(screen.getByText("Main Office")).toBeInTheDocument();
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);

      // February 30th doesn't exist
      fireEvent.change(birthDateInput, { target: { value: "02/30/2020" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(screen.getByText(/invalid date/i)).toBeInTheDocument();
      });
    });

    it("should handle incomplete date input gracefully", async () => {
      renderWithProviders(<EmployeeCreate />);

      await waitFor(() => {
        expect(screen.getByText("Main Office")).toBeInTheDocument();
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);

      // Incomplete date (missing parts)
      fireEvent.change(birthDateInput, { target: { value: "01/01" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(screen.getByText(/invalid date/i)).toBeInTheDocument();
      });
    });
  });
});
