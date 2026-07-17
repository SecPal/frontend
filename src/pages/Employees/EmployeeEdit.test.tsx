// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as deMessages } from "../../locales/de/messages.mjs";
import { messages as enMessages } from "../../locales/en/messages.mjs";
import type { Employee } from "@/types/api";
import { EmployeeEdit } from "./EmployeeEdit";
import * as employeeApi from "../../services/employeeApi";
import * as legalEntityApi from "../../services/customerLegalEntitiesApi";
import * as domainApi from "../../services/customerDomainApi";

// Mock the API modules
vi.mock("../../services/employeeApi");
vi.mock("../../services/customerLegalEntitiesApi");
vi.mock("../../services/customerDomainApi");

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
  legal_entity_id: "legal-entity-1",
  establishment_id: "establishment-1",
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

const mockLegalEntities = [
  { id: "legal-entity-1", name: "SecPal GmbH" },
  { id: "legal-entity-2", name: "SecPal Operations GmbH" },
];

const mockEstablishments = [
  { id: "establishment-1", name: "Engineering" },
  { id: "establishment-2", name: "Marketing" },
];

describe("EmployeeEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", enMessages);
    i18n.load("de", deMessages);
    i18n.activate("en");
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(mockEmployee);
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockResolvedValue(
      mockLegalEntities
    );
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue(
      mockEstablishments
    );
    vi.mocked(domainApi.listCustomerLookups).mockResolvedValue([]);
  });

  it("should load and pre-populate form with employee data", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    expect(screen.getByLabelText(/last name/i)).toHaveValue("Doe");
    expect(screen.getByLabelText(/email/i)).toHaveValue("john.doe@secpal.dev");
    expect(screen.getByLabelText(/phone/i)).toHaveValue("+1234567890");
    expect(screen.getByLabelText("Position *")).toHaveValue("Developer");
    expect(screen.getByLabelText(/date of birth/i)).toHaveValue("01/01/1990");
    expect(screen.getByLabelText(/contract start date/i)).toHaveValue(
      "01/01/2025"
    );
  });

  it("loads authorized establishments for the employee legal entity", async () => {
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValueOnce([
      mockEstablishments[0]!,
    ]);

    renderWithProviders("emp-1");

    await waitFor(() =>
      expect(domainApi.listEstablishmentLookups).toHaveBeenCalledWith(
        "legal-entity-1"
      )
    );
    expect(await screen.findByLabelText(/establishment/i)).toHaveTextContent(
      "Engineering"
    );
  });

  it("keeps edit load errors on canonical theme tokens", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockRejectedValueOnce(
      new Error("Load failed")
    );

    renderWithProviders("emp-1");

    const alert = await screen.findByText("Load failed");
    const alertTitle = screen.getByText(/error loading employee/i);
    expect(alert.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
    expect(alert.closest('[data-slot="alert"]')).toHaveClass("text-foreground");
    expect(alertTitle).toHaveAttribute("data-slot", "alert-title");
    expect(screen.queryByText("❌")).not.toBeInTheDocument();
  });

  it("hides the previous employee while a new route is loading", async () => {
    let rejectNextEmployee!: (reason: Error) => void;
    vi.mocked(employeeApi.fetchEmployee).mockImplementation((id) =>
      id === "emp-1"
        ? Promise.resolve(mockEmployee)
        : new Promise((_, reject) => {
            rejectNextEmployee = reject;
          })
    );
    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/employees/emp-1/edit"]}>
          <Link to="/employees/emp-2/edit">Next employee</Link>
          <Routes>
            <Route path="/employees/:id/edit" element={<EmployeeEdit />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );
    expect(await screen.findByLabelText(/first name/i)).toHaveValue("John");

    fireEvent.click(screen.getByRole("link", { name: /next employee/i }));

    expect(
      await screen.findByRole("status", { name: /loading employee form/i })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/first name/i)).not.toBeInTheDocument();

    await act(async () => {
      rejectNextEmployee(new Error("Employee 2 failed to load"));
    });
    expect(await screen.findByText("Employee 2 failed to load")).toBeVisible();
  });

  it("should prefill and update the current address", async () => {
    const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      addresses: [
        {
          id: "addr-old",
          street: "Altstraße",
          house_number: "1",
          postal_code: "10000",
          city: "Berlin",
          supplement: null,
          country: "DE",
          state: null,
          resided_from: "2020-01-01",
          resided_until: "2024-12-31",
        },
        {
          id: "addr-current",
          street: "Musterstraße",
          house_number: "7A",
          postal_code: "10115",
          city: "Berlin",
          supplement: null,
          country: "DE",
          state: null,
          resided_from: "2025-01-01",
          resided_until: null,
        },
      ],
    });
    mockUpdateEmployee.mockResolvedValue(mockEmployee);

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/street/i)).toHaveValue("Musterstraße");
    });

    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Neue Straße" },
    });
    fireEvent.change(screen.getByLabelText(/house number/i), {
      target: { value: "9" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateEmployee).toHaveBeenCalledWith(
        "emp-1",
        expect.objectContaining({
          addresses: [
            expect.objectContaining({
              street: "Altstraße",
              house_number: "1",
              resided_until: "2024-12-31",
            }),
            expect.objectContaining({
              street: "Neue Straße",
              house_number: "9",
              postal_code: "10115",
              city: "Berlin",
              resided_from: "2025-01-01",
              resided_until: null,
            }),
          ],
        })
      );
    });
  });

  it("should preserve historical-only address lists when saving unrelated fields", async () => {
    const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      addresses: [
        {
          id: "addr-old",
          street: "Altstraße",
          house_number: "1",
          postal_code: "10000",
          city: "Berlin",
          supplement: null,
          country: "DE",
          state: null,
          resided_from: "2020-01-01",
          resided_until: "2024-12-31",
        },
      ],
      current_address: null,
    });
    mockUpdateEmployee.mockResolvedValue(mockEmployee);

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: "+49123456789" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateEmployee).toHaveBeenCalledWith(
        "emp-1",
        expect.objectContaining({
          addresses: [
            expect.objectContaining({
              street: "Altstraße",
              house_number: "1",
              postal_code: "10000",
              city: "Berlin",
              country: "DE",
              resided_from: "2020-01-01",
              resided_until: "2024-12-31",
            }),
          ],
        })
      );
    });
    expect(vi.mocked(employeeApi.updateEmployee).mock.calls[0]?.[1]).toEqual(
      expect.objectContaining({
        addresses: [
          expect.objectContaining({
            resided_until: "2024-12-31",
          }),
        ],
      })
    );
  });

  it("should preserve a null address country when saving unrelated fields", async () => {
    const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      addresses: [
        {
          id: "addr-current",
          street: "Musterstraße",
          house_number: "7A",
          postal_code: "10115",
          city: "Berlin",
          supplement: null,
          country: null,
          state: null,
          resided_from: "2025-01-01",
          resided_until: null,
        },
      ],
    });
    mockUpdateEmployee.mockResolvedValue(mockEmployee);

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/street/i)).toHaveValue("Musterstraße");
    });

    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: "+49123456789" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateEmployee).toHaveBeenCalledWith(
        "emp-1",
        expect.objectContaining({
          addresses: [
            expect.objectContaining({
              street: "Musterstraße",
              house_number: "7A",
              postal_code: "10115",
              city: "Berlin",
              country: null,
              resided_from: "2025-01-01",
              resided_until: null,
            }),
          ],
        })
      );
    });
  });

  it("should format pre-populated dates for German locale", async () => {
    await act(async () => {
      i18n.activate("de");
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/geburtsdatum/i)).toHaveValue("01.01.1990");
    });

    expect(screen.getByLabelText(/datum des vertragsbeginns/i)).toHaveValue(
      "01.01.2025"
    );

    await act(async () => {
      i18n.activate("en");
    });
  });

  it("should keep nullable employee fields editable when optional data is missing", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      date_of_birth: null,
      contract_start_date: null,
      legal_entity_id: "legal-entity-1",
      establishment_id: "establishment-1",
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    expect(screen.getByLabelText(/date of birth/i)).toHaveValue("");
    expect(screen.getByLabelText(/contract start date/i)).toHaveValue("");
    await waitFor(() =>
      expect(
        screen.getByRole("combobox", { name: /establishment/i })
      ).toHaveTextContent("Engineering")
    );
  });

  it("should load establishments into dropdown", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /establishment/i })
      ).not.toBeDisabled();
    });

    const trigger = screen.getByRole("combobox", {
      name: /establishment/i,
    });
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

    expect(
      await screen.findByRole("option", { name: "Engineering" })
    ).toHaveAttribute("data-value", "establishment-1");
    expect(screen.getByRole("option", { name: "Marketing" })).toHaveAttribute(
      "data-value",
      "establishment-2"
    );
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
        email: "john.doe@secpal.dev",
        phone: "+1234567890",
        date_of_birth: "1990-01-01",
        position: "Developer",
        contract_start_date: "2025-01-01",
        legal_entity_id: "legal-entity-1",
        establishment_id: "establishment-1",
        management_level: 0,
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

  it("should handle establishment change", async () => {
    const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
    mockUpdateEmployee.mockResolvedValue({
      ...mockEmployee,
      legal_entity_id: "legal-entity-1",
      establishment_id: "establishment-1",
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    await selectRadixOption(/establishment/i, "Marketing");

    // Submit
    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateEmployee).toHaveBeenCalledWith(
        "emp-1",
        expect.objectContaining({
          legal_entity_id: "legal-entity-1",
          establishment_id: "establishment-2",
        })
      );
    });
  });

  it("should keep status read-only in the generic edit form", async () => {
    const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
    mockUpdateEmployee.mockResolvedValue(mockEmployee);

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    const statusSelect = screen.getByRole("combobox", { name: /status/i });
    expect(statusSelect).toBeDisabled();
    expect(statusSelect).toHaveTextContent("Active");

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(mockUpdateEmployee).toHaveBeenCalledWith(
        "emp-1",
        expect.not.objectContaining({
          status: expect.anything(),
        })
      );
    });
  });

  it("should show loading state while fetching employee", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders("emp-1");

    expect(
      screen.getByRole("status", { name: /loading employee form/i })
    ).toBeInTheDocument();

    // Cleanup to avoid memory leaks
    await waitFor(() => {}, { timeout: 100 }).catch(() => {});
  });

  it("should show loading state for establishments", async () => {
    vi.mocked(domainApi.listEstablishmentLookups).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    expect(screen.getByLabelText(/establishment/i)).toBeDisabled();
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

  it("should handle establishments loading error", async () => {
    vi.mocked(domainApi.listEstablishmentLookups).mockRejectedValue(
      new Error("Failed to load units")
    );

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
    });

    // Should still be able to edit other fields
    expect(screen.getByLabelText(/first name/i)).not.toBeDisabled();
  });

  describe("Management Level Functionality", () => {
    it("should load and display existing management level", async () => {
      const employeeWithManagement: Employee = {
        ...mockEmployee,
        management_level: 3,
      };
      vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(
        employeeWithManagement
      );

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      // Verify leadership switch is checked
      const leadershipSwitch = screen.getByRole("switch");
      expect(leadershipSwitch).toBeChecked();

      // Verify management level value is displayed
      const managementLevelInput = screen.getByRole("spinbutton");
      expect(managementLevelInput).toHaveValue(3);
      expect(managementLevelInput).not.toBeDisabled();
    });

    it("should show leadership switch unchecked for non-management employees", async () => {
      const nonManagementEmployee: Employee = {
        ...mockEmployee,
        management_level: 0,
      };
      vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(
        nonManagementEmployee
      );

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      // Verify leadership switch is NOT checked
      const leadershipSwitch = screen.getByRole("switch");
      expect(leadershipSwitch).not.toBeChecked();

      // Verify management level input is disabled
      const managementLevelInput = screen.getByRole("spinbutton");
      expect(managementLevelInput).toBeDisabled();
    });

    it("should toggle leadership position and update management level", async () => {
      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      const leadershipSwitch = screen.getByRole("switch");

      // Enable leadership
      fireEvent.click(leadershipSwitch);
      expect(leadershipSwitch).toBeChecked();

      const managementLevelInput = screen.getByRole("spinbutton");
      expect(managementLevelInput).not.toBeDisabled();

      // Set management level
      fireEvent.change(managementLevelInput, { target: { value: "5" } });
      expect(managementLevelInput).toHaveValue(5);

      // Disable leadership
      fireEvent.click(leadershipSwitch);
      expect(leadershipSwitch).not.toBeChecked();
      expect(managementLevelInput).toBeDisabled();
      expect(managementLevelInput).toHaveValue(null);
    });

    it("should update employee with management level", async () => {
      const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
      mockUpdateEmployee.mockResolvedValue({
        ...mockEmployee,
        management_level: 2,
      });

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      // Enable leadership and set management level
      const leadershipSwitch = screen.getByRole("switch");
      fireEvent.click(leadershipSwitch);

      const managementLevelInput = screen.getByRole("spinbutton");
      fireEvent.change(managementLevelInput, { target: { value: "2" } });

      // Submit
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateEmployee).toHaveBeenCalledWith(
          "emp-1",
          expect.objectContaining({
            management_level: 2,
          })
        );
      });
    });

    it("renders the leadership management level control with canonical shared input tokens", async () => {
      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      fireEvent.click(screen.getByRole("switch"));

      const managementLevelInput = screen.getByRole("spinbutton");
      const control = managementLevelInput.parentElement;
      const prefix = screen.getByText(/^ML$/);
      const currentAddressHeading = screen.getByText("Current Address");

      expect(managementLevelInput).toHaveClass(
        "bg-background",
        "text-foreground",
        "placeholder:text-muted-foreground"
      );
      expect(control).toHaveClass("relative");
      expect(prefix).toHaveClass("text-muted-foreground");
      expect(currentAddressHeading).toHaveClass("text-foreground");
      expect(control).not.toHaveClass("border-zinc-950/10", "dark:bg-white/5");
      expect(currentAddressHeading.className).not.toContain("text-zinc-800");
    });

    it("should update employee to remove management level", async () => {
      const employeeWithManagement: Employee = {
        ...mockEmployee,
        management_level: 5,
      };
      vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(
        employeeWithManagement
      );

      const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
      mockUpdateEmployee.mockResolvedValue({
        ...mockEmployee,
        management_level: 0,
      });

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      // Verify leadership is initially enabled
      const leadershipSwitch = screen.getByRole("switch");
      expect(leadershipSwitch).toBeChecked();

      // Disable leadership
      fireEvent.click(leadershipSwitch);

      // Submit
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateEmployee).toHaveBeenCalledWith(
          "emp-1",
          expect.objectContaining({
            management_level: 0,
          })
        );
      });
    });
  });

  describe("Date Formatting and Validation", () => {
    it("should format dates for display on load (US format)", async () => {
      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/date of birth/i)).toHaveValue(
          "01/01/1990"
        );
      });

      expect(screen.getByLabelText(/contract start date/i)).toHaveValue(
        "01/01/2025"
      );
    });

    it("should validate date format on blur", async () => {
      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);

      // Enter invalid date
      fireEvent.change(birthDateInput, { target: { value: "invalid-date" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(
          screen.getByText(/invalid date.*mm\/dd\/yyyy/i)
        ).toBeInTheDocument();
      });
    });

    it("should accept valid date and update form data", async () => {
      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);

      // Enter valid date
      fireEvent.change(birthDateInput, { target: { value: "06/15/1985" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(birthDateInput).toHaveValue("06/15/1985");
        expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
      });
    });

    it("should submit changed birth date without blur", async () => {
      const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
      mockUpdateEmployee.mockResolvedValue(mockEmployee);

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);
      fireEvent.change(birthDateInput, { target: { value: "06/15/1985" } });
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(mockUpdateEmployee).toHaveBeenCalledWith(
          "emp-1",
          expect.objectContaining({
            date_of_birth: "1985-06-15",
          })
        );
      });
    });

    it("should block submit when changed birth date is invalid without blur", async () => {
      const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
      mockUpdateEmployee.mockResolvedValue(mockEmployee);

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);
      fireEvent.change(birthDateInput, { target: { value: "invalid" } });
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(
          screen.getByText(/invalid date.*mm\/dd\/yyyy/i)
        ).toBeInTheDocument();
      });
      expect(mockUpdateEmployee).not.toHaveBeenCalled();
    });

    it("should accept and normalize short German date format", async () => {
      await act(async () => {
        i18n.activate("de");
      });

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/geburtsdatum/i)).toHaveValue(
          "01.01.1990"
        );
      });

      const birthDateInput = screen.getByLabelText(/geburtsdatum/i);

      fireEvent.change(birthDateInput, { target: { value: "1.1.90" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(birthDateInput).toHaveValue("01.01.1990");
        expect(screen.queryByText(/ungültiges datum/i)).not.toBeInTheDocument();
      });

      await act(async () => {
        i18n.activate("en");
      });
    });

    it("should normalize short German contract start date without year to current year", async () => {
      const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
      mockUpdateEmployee.mockResolvedValue(mockEmployee);

      await act(async () => {
        i18n.activate("de");
      });

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/datum des vertragsbeginns/i)).toHaveValue(
          "01.01.2025"
        );
      });

      const currentYear = new Date().getFullYear();
      const contractStartDateInput = screen.getByLabelText(
        /datum des vertragsbeginns/i
      );

      fireEvent.change(contractStartDateInput, { target: { value: "1.6." } });
      fireEvent.blur(contractStartDateInput);

      await waitFor(() => {
        expect(contractStartDateInput).toHaveValue(`01.06.${currentYear}`);
        expect(screen.queryByText(/ungültiges datum/i)).not.toBeInTheDocument();
      });

      fireEvent.click(
        screen.getByRole("button", {
          name: /save changes|änderungen speichern/i,
        })
      );

      await waitFor(() => {
        expect(mockUpdateEmployee).toHaveBeenCalledWith(
          "emp-1",
          expect.objectContaining({
            contract_start_date: `${currentYear}-06-01`,
          })
        );
      });

      await act(async () => {
        i18n.activate("en");
      });
    });

    it("should submit short German contract start date without blur", async () => {
      const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
      mockUpdateEmployee.mockResolvedValue(mockEmployee);

      await act(async () => {
        i18n.activate("de");
      });

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/datum des vertragsbeginns/i)).toHaveValue(
          "01.01.2025"
        );
      });

      const currentYear = new Date().getFullYear();
      const contractStartDateInput = screen.getByLabelText(
        /datum des vertragsbeginns/i
      );

      fireEvent.change(contractStartDateInput, { target: { value: "1.6." } });
      fireEvent.click(
        screen.getByRole("button", {
          name: /save changes|änderungen speichern/i,
        })
      );

      await waitFor(() => {
        expect(mockUpdateEmployee).toHaveBeenCalledWith(
          "emp-1",
          expect.objectContaining({
            contract_start_date: `${currentYear}-06-01`,
          })
        );
      });

      await act(async () => {
        i18n.activate("en");
      });
    });

    it("should block submit when changed german contract start date is invalid without blur", async () => {
      const mockUpdateEmployee = vi.mocked(employeeApi.updateEmployee);
      mockUpdateEmployee.mockResolvedValue(mockEmployee);

      await act(async () => {
        i18n.activate("de");
      });

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/datum des vertragsbeginns/i)).toHaveValue(
          "01.01.2025"
        );
      });

      fireEvent.change(screen.getByLabelText(/datum des vertragsbeginns/i), {
        target: { value: "invalid" },
      });
      fireEvent.click(
        screen.getByRole("button", {
          name: /save changes|änderungen speichern/i,
        })
      );

      await waitFor(() => {
        expect(
          screen.getByText(
            /ungültiges datum\. bitte verwenden sie das format tt\.mm\.jjjj/i
          )
        ).toBeInTheDocument();
      });
      expect(mockUpdateEmployee).not.toHaveBeenCalled();

      await act(async () => {
        i18n.activate("en");
      });
    });

    it("should validate contract start date", async () => {
      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      const contractDateInput = screen.getByLabelText(/contract start date/i);

      // Enter invalid date
      fireEvent.change(contractDateInput, { target: { value: "13/40/2025" } });
      fireEvent.blur(contractDateInput);

      await waitFor(() => {
        expect(
          screen.getByText(/invalid date.*mm\/dd\/yyyy/i)
        ).toBeInTheDocument();
      });
    });

    it("should clear date validation error on change", async () => {
      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);

      // Trigger error
      fireEvent.change(birthDateInput, { target: { value: "99/99/9999" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(screen.getByText(/invalid date/i)).toBeInTheDocument();
      });

      // Change again - error should clear
      fireEvent.change(birthDateInput, { target: { value: "01/01/1990" } });

      await waitFor(() => {
        expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
      });
    });

    it("should reject dates outside valid year range", async () => {
      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);

      // Year too early
      fireEvent.change(birthDateInput, { target: { value: "01/01/1850" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(screen.getByText(/invalid date/i)).toBeInTheDocument();
      });

      // Year too late
      fireEvent.change(birthDateInput, { target: { value: "01/01/2150" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(screen.getByText(/invalid date/i)).toBeInTheDocument();
      });
    });

    it("should handle incomplete date strings", async () => {
      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);

      // Incomplete date
      fireEvent.change(birthDateInput, { target: { value: "01/01" } });
      fireEvent.blur(birthDateInput);

      await waitFor(() => {
        expect(screen.getByText(/invalid date/i)).toBeInTheDocument();
      });
    });

    it("should handle empty date input on blur", async () => {
      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/first name/i)).toHaveValue("John");
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);

      // Clear the field
      fireEvent.change(birthDateInput, { target: { value: "" } });
      fireEvent.blur(birthDateInput);

      // Should not show error for empty field
      await waitFor(() => {
        expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
      });
    });

    it("should render empty string for date inputs when employee has no dates", async () => {
      vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
        ...mockEmployee,
        date_of_birth: null,
        contract_start_date: null,
      });

      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/date of birth/i)).toHaveValue("");
      });
      expect(screen.getByLabelText(/contract start date/i)).toHaveValue("");
    });

    it("should reformat dates reactively when locale switches from en to de", async () => {
      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/date of birth/i)).toHaveValue(
          "01/01/1990"
        );
      });

      await act(async () => {
        i18n.activate("de");
      });

      await waitFor(() => {
        expect(screen.getByLabelText(/geburtsdatum/i)).toHaveValue(
          "01.01.1990"
        );
      });
      expect(screen.getByLabelText(/datum des vertragsbeginns/i)).toHaveValue(
        "01.01.2025"
      );

      await act(async () => {
        i18n.activate("en");
      });
    });

    it("should keep user-typed date unchanged when locale switches while field is dirty", async () => {
      renderWithProviders("emp-1");

      await waitFor(() => {
        expect(screen.getByLabelText(/date of birth/i)).toHaveValue(
          "01/01/1990"
        );
      });

      const birthDateInput = screen.getByLabelText(/date of birth/i);
      fireEvent.change(birthDateInput, { target: { value: "06/15/1985" } });

      await act(async () => {
        i18n.activate("de");
      });

      // Dirty field must not be re-formatted by locale switch
      await waitFor(() => {
        expect(screen.getByLabelText(/geburtsdatum/i)).toHaveValue(
          "06/15/1985"
        );
      });

      await act(async () => {
        i18n.activate("en");
      });
    });
  });
});
