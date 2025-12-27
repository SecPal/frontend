// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { EmployeeList } from "./EmployeeList";
import * as employeeApi from "../../services/employeeApi";
import type {
  Employee,
  EmployeeListResponse,
} from "../../services/employeeApi";

// Mock the employee API
vi.mock("../../services/employeeApi");

// Helper to render with providers
const renderWithProviders = () => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>
        <EmployeeList />
      </MemoryRouter>
    </I18nProvider>
  );
};

const mockEmployees: Employee[] = [
  {
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
    management_level: 0,
    organizational_unit: {
      id: "unit-1",
      name: "Engineering",
    },
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "emp-2",
    employee_number: "E002",
    first_name: "Jane",
    last_name: "Smith",
    full_name: "Jane Smith",
    email: "jane.smith@example.com",
    phone: "+0987654321",
    date_of_birth: "1992-05-15",
    position: "Designer",
    management_level: 0,
    contract_start_date: "2024-06-01",
    status: "active",
    contract_type: "full_time",
    organizational_unit: {
      id: "unit-2",
      name: "Design",
    },
    created_at: "2024-06-01T00:00:00Z",
    updated_at: "2024-06-01T00:00:00Z",
  },
];

const mockResponse: EmployeeListResponse = {
  data: mockEmployees,
  meta: {
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 2,
  },
};

describe("EmployeeList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(employeeApi.fetchEmployees).mockResolvedValue(mockResponse);
  });

  it("should render employee list with table", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /employee management/i })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john.doe@example.com")).toBeInTheDocument();
    expect(screen.getByText("E001")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();

    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("jane.smith@example.com")).toBeInTheDocument();
    expect(screen.getByText("E002")).toBeInTheDocument();
    expect(screen.getByText("Designer")).toBeInTheDocument();
    expect(screen.getByText("Design")).toBeInTheDocument();
  });

  it("should display status badges for employees", async () => {
    renderWithProviders();

    await waitFor(() => {
      // "Active" appears in status dropdown options + 2 employee badges
      expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("should have Add Employee button", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /add employee/i })
      ).toBeInTheDocument();
    });

    const addButton = screen.getByRole("link", { name: /add employee/i });
    expect(addButton).toHaveAttribute("href", "/employees/create");
  });

  it("should display loading state", () => {
    vi.mocked(employeeApi.fetchEmployees).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders();

    expect(screen.getByText(/loading employees/i)).toBeInTheDocument();
  });

  it("should display error message on fetch failure", async () => {
    vi.mocked(employeeApi.fetchEmployees).mockRejectedValue(
      new Error("Network error")
    );

    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /error loading employees/i })
      ).toBeInTheDocument();
    });

    expect(screen.getByText(/network error/i)).toBeInTheDocument();
  });

  it("should filter by status", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const statusSelect = screen.getByLabelText(/status/i);
    fireEvent.change(statusSelect, { target: { value: "active" } });

    await waitFor(() => {
      expect(employeeApi.fetchEmployees).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active", page: 1 })
      );
    });
  });

  it("should handle search input", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by name or email/i);
    fireEvent.change(searchInput, { target: { value: "john" } });

    await waitFor(() => {
      expect(employeeApi.fetchEmployees).toHaveBeenCalledWith(
        expect.objectContaining({ search: "john", page: 1 })
      );
    });
  });

  it("should navigate to employee detail on row click", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Find the row link by checking the table row
    const rows = screen.getAllByRole("row");
    const johnDoeRow = rows.find((row) =>
      row.textContent?.includes("John Doe")
    );
    expect(johnDoeRow).toBeInTheDocument();

    // The TableRow with href becomes a clickable link
    const link = johnDoeRow?.querySelector("a");
    expect(link).toHaveAttribute("href", "/employees/emp-1");
  });

  it("should display pagination when multiple pages", async () => {
    const paginatedResponse: EmployeeListResponse = {
      data: mockEmployees,
      meta: {
        current_page: 1,
        last_page: 3,
        per_page: 15,
        total: 45,
      },
    };
    vi.mocked(employeeApi.fetchEmployees).mockResolvedValue(paginatedResponse);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    // Check pagination buttons are displayed
    expect(
      screen.getAllByRole("button", { name: /previous/i }).length
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("button", { name: /next/i }).length
    ).toBeGreaterThan(0);
    // "Showing" text appears in pagination (rendered for both mobile and desktop views)
    const showingElements = screen.getAllByText((_content, element) => {
      return element?.textContent?.includes("Showing") === true;
    });
    expect(showingElements.length).toBeGreaterThan(0);
  });

  it("should handle next page click", async () => {
    const paginatedResponse: EmployeeListResponse = {
      data: mockEmployees,
      meta: {
        current_page: 1,
        last_page: 3,
        per_page: 15,
        total: 45,
      },
    };
    vi.mocked(employeeApi.fetchEmployees).mockResolvedValue(paginatedResponse);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const nextButtons = screen.getAllByRole("button", { name: /next/i });
    fireEvent.click(nextButtons[0]!);

    await waitFor(() => {
      expect(employeeApi.fetchEmployees).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });

  it("should disable previous button on first page", async () => {
    const paginatedResponse: EmployeeListResponse = {
      data: mockEmployees,
      meta: {
        current_page: 1,
        last_page: 3,
        per_page: 15,
        total: 45,
      },
    };
    vi.mocked(employeeApi.fetchEmployees).mockResolvedValue(paginatedResponse);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const previousButtons = screen.getAllByRole("button", {
      name: /previous/i,
    });
    previousButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it("should have view buttons for each employee", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const viewButtons = screen.getAllByRole("link", { name: /view/i });
    expect(viewButtons.length).toBe(2);
    expect(viewButtons[0]).toHaveAttribute("href", "/employees/emp-1");
    expect(viewButtons[1]).toHaveAttribute("href", "/employees/emp-2");
  });

  it("should handle non-Error object errors on fetch failure", async () => {
    vi.mocked(employeeApi.fetchEmployees).mockRejectedValue({
      message: "Custom error object",
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/custom error object/i)).toBeInTheDocument();
    });
  });

  it("should show pagination info text correctly", async () => {
    const paginatedResponse: EmployeeListResponse = {
      data: mockEmployees,
      meta: {
        current_page: 2,
        last_page: 5,
        per_page: 15,
        total: 62,
      },
    };
    vi.mocked(employeeApi.fetchEmployees).mockResolvedValue(paginatedResponse);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/showing/i)).toBeInTheDocument();
      expect(screen.getByText(/16/i)).toBeInTheDocument(); // Start: (2-1)*15+1 = 16
      expect(screen.getByText(/30/i)).toBeInTheDocument(); // End: min(2*15, 62) = 30
      expect(screen.getByText(/62/i)).toBeInTheDocument(); // Total
    });
  });

  describe("Management Level Display", () => {
    it("should display management level badges in list for leadership positions", async () => {
      const employeesWithManagement: Employee[] = [
        {
          ...mockEmployees[0],
          management_level: 1,
          position: "CEO",
        } as Employee,
        {
          ...mockEmployees[1],
          management_level: 5,
          position: "Area Manager",
        } as Employee,
      ];

      const responseWithManagement: EmployeeListResponse = {
        data: employeesWithManagement,
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 15,
          total: 2,
        },
      };

      vi.mocked(employeeApi.fetchEmployees).mockResolvedValue(
        responseWithManagement
      );

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Should display ML badges
      const mlBadges = screen.getAllByText(/ML/);
      expect(mlBadges.length).toBeGreaterThanOrEqual(2);

      // Check for specific management levels
      expect(screen.getByText(/ML\s+1/)).toBeInTheDocument();
      expect(screen.getByText(/ML\s+5/)).toBeInTheDocument();
    });

    it("should not display management level badge for non-management employees", async () => {
      const nonManagementEmployees: Employee[] = [
        {
          ...mockEmployees[0],
          management_level: 0,
        } as Employee,
        {
          ...mockEmployees[1],
          management_level: 0,
        } as Employee,
      ];

      const responseWithoutManagement: EmployeeListResponse = {
        data: nonManagementEmployees,
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 15,
          total: 2,
        },
      };

      vi.mocked(employeeApi.fetchEmployees).mockResolvedValue(
        responseWithoutManagement
      );

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Should NOT display ML badges
      expect(screen.queryByText(/ML/)).not.toBeInTheDocument();
    });

    it("should display mixed management levels correctly", async () => {
      const mixedEmployees: Employee[] = [
        {
          ...mockEmployees[0],
          management_level: 3,
          position: "Branch Director",
        } as Employee,
        {
          ...mockEmployees[1],
          management_level: 0,
          position: "Guard",
        } as Employee,
      ];

      const mixedResponse: EmployeeListResponse = {
        data: mixedEmployees,
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 15,
          total: 2,
        },
      };

      vi.mocked(employeeApi.fetchEmployees).mockResolvedValue(mixedResponse);

      renderWithProviders();

      await waitFor(() => {
        expect(screen.getByText("John Doe")).toBeInTheDocument();
      });

      // Should display ML badge for management employee
      expect(screen.getByText(/ML/)).toBeInTheDocument();
      expect(screen.getByText(/3/)).toBeInTheDocument();

      // Guard (non-management) should not have ML badge - only one ML badge total
      const mlBadges = screen.queryAllByText(/ML/);
      expect(mlBadges).toHaveLength(1);
    });
  });
});
