// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { Employee } from "@/types/api";
import { EmployeeDetail } from "./EmployeeDetail";
import * as employeeApi from "../../services/employeeApi";
import * as qualificationApi from "../../services/qualificationApi";
import * as documentApi from "../../services/employeeDocumentApi";

const { mockUseUserCapabilities } = vi.hoisted(() => ({
  mockUseUserCapabilities: vi.fn(),
}));

// Mock the API modules
vi.mock("../../services/employeeApi");
vi.mock("../../services/qualificationApi");
vi.mock("../../services/employeeDocumentApi");
vi.mock("../../hooks/useUserCapabilities", () => ({
  useUserCapabilities: mockUseUserCapabilities,
}));

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
  email: "john.doe@secpal.dev",
  phone: "+1234567890",
  date_of_birth: "1990-01-01",
  position: "Developer",
  contract_start_date: "2025-01-01",
  status: "active",
  contract_type: "full_time",
  management_level: 0,
  onboarding_invitation: {
    status: "sent",
    requested_at: "2025-01-01T09:00:00Z",
    token_created_at: "2025-01-01T09:00:00Z",
    mail_sent_at: "2025-01-01T09:01:00Z",
    mail_failed_at: null,
    failure_reason: null,
  },
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
    mockUseUserCapabilities.mockReturnValue({
      actions: {
        employees: {
          create: true,
          update: true,
          delete: true,
          activate: true,
          terminate: true,
        },
      },
    });

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
    expect(screen.getByText("john.doe@secpal.dev")).toBeInTheDocument();
    expect(screen.getByText("+1234567890")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("should display onboarding invitation failure details", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      onboarding_invitation: {
        status: "created_not_sent",
        requested_at: "2025-01-01T09:00:00Z",
        token_created_at: "2025-01-01T09:00:00Z",
        mail_sent_at: null,
        mail_failed_at: "2025-01-01T09:02:00Z",
        failure_reason: "Frontend URL or employee email not configured",
      },
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByText("Created, but not sent")).toBeInTheDocument();
    });

    expect(
      screen.getByText("Frontend URL or employee email not configured")
    ).toBeInTheDocument();
  });

  it("should display active status badge", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  it("should display applicant status badge", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      status: "applicant",
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getAllByText("Applicant").length).toBeGreaterThan(0);
    });
  });

  it("should fall back to the raw status label for unknown values", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      status: "archived" as Employee["status"],
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByText("archived")).toBeInTheDocument();
    });
  });

  it("should render placeholders for nullable employee profile fields", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      date_of_birth: null,
      contract_start_date: null,
      organizational_unit: null,
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "John Doe" })
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(3);
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

  it("hides employee management actions without the matching capabilities", async () => {
    mockUseUserCapabilities.mockReturnValue({
      actions: {
        employees: {
          create: false,
          update: false,
          delete: false,
          activate: false,
          terminate: false,
        },
      },
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "John Doe" })
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("link", { name: /^edit$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /terminate/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /activate/i })
    ).not.toBeInTheDocument();
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
