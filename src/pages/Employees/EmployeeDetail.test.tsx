// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { EmployeeDetail } from "./EmployeeDetail";
import * as employeeApi from "../../services/employeeApi";
import * as qualificationApi from "../../services/qualificationApi";
import * as documentApi from "../../services/employeeDocumentApi";
import type { Employee } from "../../services/employeeApi";

// Mock the API modules
vi.mock("../../services/employeeApi");
vi.mock("../../services/qualificationApi");
vi.mock("../../services/employeeDocumentApi");

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
      <MemoryRouter initialEntries={[`/employees/${employeeId}`]}>
        <Routes>
          <Route path="/employees/:id" element={<EmployeeDetail />} />
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
  management_level: 0,
  organizational_unit: {
    id: "unit-1",
    name: "Engineering",
  },
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

describe("EmployeeDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(mockEmployee);
    vi.mocked(qualificationApi.fetchEmployeeQualifications).mockResolvedValue(
      []
    );
    vi.mocked(documentApi.fetchEmployeeDocuments).mockResolvedValue([]);
  });

  it("should render employee details", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "John Doe" })
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText("E001").length).toBeGreaterThan(0);
    expect(screen.getByText("john.doe@example.com")).toBeInTheDocument();
    expect(screen.getByText("+1234567890")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
  });

  it("should display active status badge", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  it("should display error on fetch failure", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockRejectedValue(
      new Error("Not found")
    );

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /error/i })
      ).toBeInTheDocument();
      expect(screen.getByText(/not found/i)).toBeInTheDocument();
    });
  });

  it("should have back to employees link", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "John Doe" })
      ).toBeInTheDocument();
    });

    const backLink = screen.getByRole("link", {
      name: /back to employees/i,
    });
    expect(backLink).toHaveAttribute("href", "/employees");
  });

  it("should have edit button link", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "John Doe" })
      ).toBeInTheDocument();
    });

    const editLink = screen.getByRole("link", { name: /^edit$/i });
    expect(editLink).toHaveAttribute("href", "/employees/emp-1/edit");
  });

  it("should display loading state", () => {
    vi.mocked(employeeApi.fetchEmployee).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders("emp-1");

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("should handle terminate employee action with confirm", async () => {
    // Mock window.confirm
    const mockConfirm = vi.spyOn(window, "confirm");
    mockConfirm.mockReturnValue(true);

    vi.mocked(employeeApi.terminateEmployee).mockResolvedValue({
      ...mockEmployee,
      status: "terminated",
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "John Doe" })
      ).toBeInTheDocument();
    });

    const terminateButton = screen.getByRole("button", { name: /terminate/i });
    fireEvent.click(terminateButton);

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith("Terminate this employee?");
      expect(employeeApi.terminateEmployee).toHaveBeenCalledWith("emp-1");
    });

    mockConfirm.mockRestore();
  });

  it("should show activate button for pre-contract employee", async () => {
    const preContractEmployee = {
      ...mockEmployee,
      status: "pre_contract" as const,
    };
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(preContractEmployee);

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByText("Pre-Contract")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /activate/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /terminate/i })
    ).not.toBeInTheDocument();
  });

  it("should switch between tabs", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "John Doe" })
      ).toBeInTheDocument();
    });

    // Initially on Profile tab
    expect(screen.getByRole("button", { name: /^profile$/i })).toHaveAttribute(
      "class",
      expect.stringContaining("border-zinc-950")
    );

    // Click Qualifications tab
    const qualificationsTab = screen.getByRole("button", {
      name: /qualifications/i,
    });
    fireEvent.click(qualificationsTab);

    await waitFor(() => {
      expect(qualificationApi.fetchEmployeeQualifications).toHaveBeenCalledWith(
        "emp-1"
      );
    });
  });

  it("should display no qualifications message", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "John Doe" })
      ).toBeInTheDocument();
    });

    // Click Qualifications tab
    const qualificationsTab = screen.getByRole("button", {
      name: /qualifications/i,
    });
    fireEvent.click(qualificationsTab);

    await waitFor(() => {
      expect(
        screen.getByText(/no qualifications assigned/i)
      ).toBeInTheDocument();
    });
  });

  it("should display no documents message on Documents tab", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "John Doe" })
      ).toBeInTheDocument();
    });

    // Click Documents tab
    const documentsTab = screen.getByRole("button", { name: /documents/i });
    fireEvent.click(documentsTab);

    await waitFor(() => {
      expect(screen.getByText(/no documents uploaded/i)).toBeInTheDocument();
    });
  });

  it("should handle non-Error object errors on activate", async () => {
    const preContractEmployee = {
      ...mockEmployee,
      status: "pre_contract" as const,
    };
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(preContractEmployee);

    vi.mocked(employeeApi.activateEmployee).mockRejectedValueOnce({
      message: "Custom activation error",
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    // Spy on console.error to verify error is logged
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /activate/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /activate/i }));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to activate employee:",
        expect.objectContaining({ message: "Custom activation error" })
      );
    });

    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("should handle non-Error object errors on terminate", async () => {
    vi.mocked(employeeApi.terminateEmployee).mockRejectedValueOnce({
      message: "Custom termination error",
    });

    vi.spyOn(window, "confirm").mockReturnValue(true);

    // Spy on console.error to verify error is logged
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /terminate/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /terminate/i }));

    await waitFor(() => {
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to terminate employee:",
        expect.objectContaining({ message: "Custom termination error" })
      );
    });

    consoleErrorSpy.mockRestore();
    vi.restoreAllMocks();
  });

  it("should not terminate if user cancels confirm dialog", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /terminate/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /terminate/i }));

    expect(employeeApi.terminateEmployee).not.toHaveBeenCalled();

    vi.restoreAllMocks();
  });

  describe("Management Level Display", () => {
    it("should display management level badge for leadership positions", async () => {
      const managementEmployee: Employee = {
        ...mockEmployee,
        management_level: 3,
      };
      vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(
        managementEmployee
      );

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "John Doe" })
        ).toBeInTheDocument();
      });

      // Should display "ML 3" badge
      expect(screen.getByText(/ML\s+3/)).toBeInTheDocument();
    });

    it("should not display management level badge for non-management employees", async () => {
      const nonManagementEmployee: Employee = {
        ...mockEmployee,
        management_level: 0,
      };
      vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(
        nonManagementEmployee
      );

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "John Doe" })
        ).toBeInTheDocument();
      });

      // Should NOT display ML badge
      expect(screen.queryByText(/ML/)).not.toBeInTheDocument();
    });

    it("should display high management level (CEO level)", async () => {
      const ceoEmployee: Employee = {
        ...mockEmployee,
        management_level: 1,
        position: "Chief Executive Officer",
      };
      vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(ceoEmployee);

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(
          screen.getByRole("heading", { name: "John Doe" })
        ).toBeInTheDocument();
      });

      // Should display "ML 1" badge
      expect(screen.getByText(/ML\s+1/)).toBeInTheDocument();
    });
  });
});
