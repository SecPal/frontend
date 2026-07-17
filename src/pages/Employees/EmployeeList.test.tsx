// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as enMessages } from "../../locales/en/messages.mjs";
import type { Employee, EmployeeListResponse } from "@/types/api";
import { EmployeeList } from "./EmployeeList";
import * as employeeApi from "../../services/employeeApi";
import * as legalEntityApi from "../../services/customerLegalEntitiesApi";
import * as domainApi from "../../services/customerDomainApi";

const { mockUseUserCapabilities } = vi.hoisted(() => ({
  mockUseUserCapabilities: vi.fn(),
}));

// Mock the employee API
vi.mock("../../services/employeeApi");
vi.mock("../../services/customerLegalEntitiesApi");
vi.mock("../../services/customerDomainApi");
vi.mock("../../hooks/useUserCapabilities", () => ({
  useUserCapabilities: mockUseUserCapabilities,
}));

// Helper to render with providers
const renderWithProviders = () => {
  i18n.load("en", enMessages);
  i18n.activate("en");
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>
        <EmployeeList />
      </MemoryRouter>
    </I18nProvider>
  );
};

function setViewportMatchesDesktop(matches: boolean) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches,
      media: "(min-width: 40rem)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

async function selectRadixOption(
  triggerName: RegExp,
  optionName: RegExp | string
) {
  const trigger = screen.getByRole("combobox", { name: triggerName });
  await waitFor(() => expect(trigger).not.toBeDisabled());
  fireEvent.pointerDown(trigger, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.pointerUp(trigger, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.click(trigger, { button: 0 });

  const option = await screen.findByRole("option", { name: optionName });
  fireEvent.pointerDown(option, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.pointerUp(option, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.click(option, { button: 0 });
}

async function openRadixSelect(triggerName: RegExp) {
  const trigger = screen.getByRole("combobox", { name: triggerName });
  fireEvent.pointerDown(trigger, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.pointerUp(trigger, {
    button: 0,
    pointerId: 1,
    pointerType: "mouse",
  });
  fireEvent.click(trigger, { button: 0 });
}

const mockEmployees: Employee[] = [
  {
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
    legal_entity_id: "legal-entity-1",
    establishment_id: "establishment-1",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "emp-2",
    employee_number: "E002",
    first_name: "Jane",
    last_name: "Smith",
    full_name: "Jane Smith",
    email: "jane.smith@secpal.dev",
    phone: "+0987654321",
    date_of_birth: "1992-05-15",
    position: "Designer",
    management_level: 0,
    contract_start_date: "2024-06-01",
    status: "active",
    contract_type: "full_time",
    legal_entity_id: "legal-entity-1",
    establishment_id: "establishment-1",
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
    setViewportMatchesDesktop(true);
    mockUseUserCapabilities.mockReturnValue({
      actions: {
        employees: {
          create: true,
          update: true,
          delete: true,
          activate: true,
          confirmOnboarding: true,
          terminate: true,
        },
      },
    });
    vi.mocked(employeeApi.fetchEmployees).mockResolvedValue(mockResponse);
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockResolvedValue([
      { id: "legal-entity-1", name: "SecPal GmbH" },
    ]);
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "establishment-1", name: "Engineering" },
      { id: "establishment-2", name: "Design" },
    ]);
    vi.mocked(domainApi.listCustomerLookups).mockResolvedValue([]);
  });

  it("should render employee list with table", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /employee management/i })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john.doe@secpal.dev")).toBeInTheDocument();
    expect(screen.getByText("E001")).toBeInTheDocument();
    expect(screen.getByText("Developer")).toBeInTheDocument();
    expect(screen.getAllByText("legal-entity-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("establishment-1").length).toBeGreaterThan(0);

    expect(screen.getByText("Jane Smith")).toBeInTheDocument();
    expect(screen.getByText("jane.smith@secpal.dev")).toBeInTheDocument();
    expect(screen.getByText("E002")).toBeInTheDocument();
    expect(screen.getByText("Designer")).toBeInTheDocument();
  });

  it("renders employees as mobile cards on narrow viewports", async () => {
    setViewportMatchesDesktop(false);

    renderWithProviders();

    expect(await screen.findByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("john.doe@secpal.dev")).toBeInTheDocument();
    expect(screen.getAllByText("legal-entity-1").length).toBeGreaterThan(0);
    expect(screen.getAllByText("establishment-1").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("link", { name: /view john doe/i })
    ).toHaveAttribute("href", "/employees/emp-1");
    expect(
      screen.queryByRole("columnheader", { name: /employee/i })
    ).not.toBeInTheDocument();
  });

  it("renders the migrated shadcn/Radix list surface with light and dark classes", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const filterCard = document.querySelector('[data-slot="card"]');
    expect(filterCard).toHaveClass("bg-card", "text-card-foreground");

    const statusTrigger = screen.getByRole("combobox", { name: /^status$/i });
    expect(statusTrigger).toHaveAttribute("data-slot", "select-trigger");
    expect(statusTrigger).toHaveClass("bg-background", "border-input");

    expect(
      document.querySelector('[data-slot="employee-table-shell"]')
    ).toBeInTheDocument();
  });

  it("should display status badges for employees", async () => {
    renderWithProviders();

    await waitFor(() => {
      // "Active" appears in status dropdown options + 2 employee badges
      expect(screen.getAllByText("Active").length).toBeGreaterThanOrEqual(2);
    });
  });

  it("should show applicant in status filters and badges", async () => {
    vi.mocked(employeeApi.fetchEmployees).mockResolvedValue({
      data: [{ ...mockEmployees[0]!, status: "applicant" }],
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 15,
        total: 1,
      },
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getAllByText("Applicant").length).toBeGreaterThan(0);
    });

    await openRadixSelect(/^status$/i);

    expect(
      await screen.findByRole("option", { name: /applicant/i })
    ).toBeInTheDocument();
  });

  it("should render placeholders when domain assignments are missing", async () => {
    vi.mocked(employeeApi.fetchEmployees).mockResolvedValue({
      data: [
        { ...mockEmployees[0]!, legal_entity_id: "", establishment_id: "" },
      ],
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 15,
        total: 1,
      },
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(2);
  });

  it("should have Add Employee button", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /employee management/i })
      ).toBeInTheDocument();
    });

    const addButton = screen.getByRole("link", { name: /add employee/i });
    expect(addButton).toBeInTheDocument();
    expect(addButton).toHaveAttribute("href", "/employees/create");
  });

  it("hides the add employee CTA without create capability", async () => {
    mockUseUserCapabilities.mockReturnValue({
      actions: {
        employees: {
          create: false,
          update: false,
          delete: false,
          activate: false,
          confirmOnboarding: false,
          terminate: false,
        },
      },
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("link", { name: /add employee/i })
    ).not.toBeInTheDocument();
  });

  it("keeps list feedback and pagination on canonical theme tokens", async () => {
    vi.mocked(employeeApi.fetchEmployees).mockRejectedValue(
      new Error("API Error")
    );

    renderWithProviders();

    const alert = await screen.findByText("API Error");
    const alertTitle = screen.getByText(/error loading employees/i);
    expect(alert.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
    expect(alert.closest('[data-slot="alert"]')).toHaveClass("text-foreground");
    expect(alertTitle).toHaveAttribute("data-slot", "alert-title");
  });

  it("renders filters and table skeleton rows while initially loading", () => {
    vi.mocked(employeeApi.fetchEmployees).mockImplementation(
      () => new Promise(() => {})
    );
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockImplementation(
      () => new Promise(() => {})
    );

    const { container } = renderWithProviders();

    expect(
      screen.getByRole("heading", { name: /employee management/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /employee #/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading employees table/i })
    ).toBeInTheDocument();
    expect(
      container.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0);
    expect(
      screen.queryByText(/^Loading employees\.\.\.$/i)
    ).not.toBeInTheDocument();
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

    await selectRadixOption(/^status$/i, /^active$/i);

    await waitFor(() => {
      expect(employeeApi.fetchEmployees).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active", page: 1 })
      );
    });
  });

  it("should filter by authorized establishment", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    await selectRadixOption(/^legal entity$/i, /SecPal GmbH/i);
    await selectRadixOption(/^establishment$/i, /design/i);

    await waitFor(() => {
      expect(employeeApi.fetchEmployees).toHaveBeenCalledWith(
        expect.objectContaining({
          legal_entity_id: "legal-entity-1",
          establishment_id: "establishment-2",
          page: 1,
        })
      );
    });
  });

  it("clears optional domain filters without reloading the page", async () => {
    renderWithProviders();

    await waitFor(() =>
      expect(screen.getByText("John Doe")).toBeInTheDocument()
    );
    await selectRadixOption(/^legal entity$/i, /SecPal GmbH/i);
    await selectRadixOption(/^establishment$/i, /Design/i);
    fireEvent.click(
      screen.getByRole("button", { name: /clear domain filters/i })
    );

    await waitFor(() => {
      expect(employeeApi.fetchEmployees).toHaveBeenLastCalledWith(
        expect.not.objectContaining({
          legal_entity_id: expect.anything(),
          establishment_id: expect.anything(),
        })
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

  it("keeps existing rows visible while refreshing search results", async () => {
    vi.mocked(employeeApi.fetchEmployees)
      .mockResolvedValueOnce(mockResponse)
      .mockImplementationOnce(
        () =>
          new Promise<Awaited<ReturnType<typeof employeeApi.fetchEmployees>>>(
            () => {}
          )
      );

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("John Doe")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search by name or email/i);
    fireEvent.change(searchInput, { target: { value: "jane" } });

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading employees table/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /employee #/i })
    ).toBeInTheDocument();
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
