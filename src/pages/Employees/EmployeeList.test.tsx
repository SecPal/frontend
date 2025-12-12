// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { EmployeeList } from "./EmployeeList";
import * as employeeApi from "../../services/employeeApi";

// Mock the employee API
vi.mock("../../services/employeeApi", () => ({
  fetchEmployees: vi.fn(),
}));

// Mock @lingui/macro
vi.mock("@lingui/macro", () => ({
  Trans: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  msg: (str: { id: string }) => str.id,
}));

// Mock @lingui/react
vi.mock("@lingui/react", () => ({
  useLingui: () => ({ _: (str: { id: string }) => str.id }),
}));

function renderWithRouter(component: React.ReactElement) {
  return render(<BrowserRouter>{component}</BrowserRouter>);
}

describe("EmployeeList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should render loading state initially", () => {
    vi.mocked(employeeApi.fetchEmployees).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithRouter(<EmployeeList />);

    expect(screen.getByText("Loading employees...")).toBeInTheDocument();
  });

  it("should render employee list after successful fetch", async () => {
    const mockEmployees = {
      data: [
        {
          id: "1",
          employee_number: "E001",
          first_name: "John",
          last_name: "Doe",
          full_name: "John Doe",
          email: "john@example.com",
          status: "active" as const,
          position: "Security Guard",
          phone: "+1234567890",
          date_of_birth: "1990-01-01",
          contract_start_date: "2025-01-01",
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

    vi.mocked(employeeApi.fetchEmployees).mockResolvedValueOnce(mockEmployees);

    renderWithRouter(<EmployeeList />);

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
      expect(screen.getByText("E001")).toBeInTheDocument();
      expect(screen.getByText("Security Guard")).toBeInTheDocument();
      expect(screen.getByText("Unit A")).toBeInTheDocument();
    });
  });

  it("should render error message on fetch failure", async () => {
    vi.mocked(employeeApi.fetchEmployees).mockRejectedValueOnce(
      new Error("Network error")
    );

    renderWithRouter(<EmployeeList />);

    await waitFor(() => {
      expect(screen.getByText(/Network error/i)).toBeInTheDocument();
    });
  });

  it("should render empty state when no employees", async () => {
    const emptyResponse = {
      data: [],
      meta: {
        current_page: 1,
        per_page: 15,
        total: 0,
        last_page: 1,
      },
    };

    vi.mocked(employeeApi.fetchEmployees).mockResolvedValueOnce(emptyResponse);

    renderWithRouter(<EmployeeList />);

    await waitFor(() => {
      expect(screen.getByText("No employees found")).toBeInTheDocument();
    });
  });
});
