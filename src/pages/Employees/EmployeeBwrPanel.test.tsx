// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Employee } from "@/types/api";
import { messages as deMessages } from "../../locales/de/messages.mjs";
import { messages as enMessages } from "../../locales/en/messages.mjs";
import { ApiError } from "../../services/ApiError";
import * as employeeApi from "../../services/employeeApi";
import { EmployeeBwrPanel } from "./EmployeeBwrPanel";

vi.mock("../../services/employeeApi", () => ({
  updateEmployee: vi.fn(),
  updateEmployeeBwrStatus: vi.fn(),
}));

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
  bwr_id: null,
  bwr_status: "not_registered",
  bwr_registered_at: null,
  bwr_submission_date: null,
  bwr_notes: null,
  status: "active",
  contract_type: "full_time",
  management_level: 0,
  onboarding_completed: false,
  onboarding_workflow: {
    status: "invited",
  },
  onboarding_invitation: {
    status: "sent",
    requested_at: "2025-01-01T09:00:00Z",
    token_created_at: "2025-01-01T09:00:00Z",
    mail_sent_at: "2025-01-01T09:01:00Z",
    mail_failed_at: null,
    failure_reason: null,
  },
  legal_entity_id: "legal-entity-1",
  establishment_id: "establishment-1",
  addresses: [],
  structured_address: null,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

function renderPanel({
  employee = mockEmployee,
  onRefresh = vi.fn().mockResolvedValue(null),
  canManage = true,
}: {
  employee?: Employee;
  onRefresh?: (
    employeeId: string,
    routeOwner: object
  ) => Promise<Employee | null>;
  canManage?: boolean;
} = {}) {
  const routeOwner = {};
  return render(
    <I18nProvider i18n={i18n}>
      <EmployeeBwrPanel
        employee={employee}
        canManage={canManage}
        routeOwner={routeOwner}
        onRefresh={onRefresh}
      />
    </I18nProvider>
  );
}

async function selectOption(triggerName: RegExp, optionName: RegExp | string) {
  const trigger = screen.getByRole("combobox", { name: triggerName });
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

describe("EmployeeBwrPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", enMessages);
    i18n.load("de", deMessages);
    i18n.activate("en");
  });

  it("records a manual report date without exposing export controls or changing status", async () => {
    const reportedEmployee = {
      ...mockEmployee,
      bwr_submission_date: "2026-11-27",
    };
    const onRefresh = vi.fn().mockResolvedValue(reportedEmployee);
    vi.mocked(employeeApi.updateEmployee).mockResolvedValue(reportedEmployee);
    renderPanel({ onRefresh });

    expect(screen.queryByRole("button", { name: /export/i })).toBeNull();
    expect(screen.queryByRole("combobox", { name: /export/i })).toBeNull();
    expect(screen.queryByRole("link", { name: /download/i })).toBeNull();
    expect(
      screen.getByRole("button", { name: /save bwr status/i })
    ).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/^BWR Submission Date$/i), {
      target: { value: "2026-11-27" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /save bwr submission date/i })
    );

    await waitFor(() => {
      expect(employeeApi.updateEmployee).toHaveBeenCalledWith("emp-1", {
        bwr_submission_date: "2026-11-27",
      });
      expect(screen.getByRole("status")).toHaveTextContent(
        "BWR submission date saved."
      );
    });
    expect(employeeApi.updateEmployeeBwrStatus).not.toHaveBeenCalled();
  });

  it("marks a recorded report pending without sending the employee's existing BWR ID", async () => {
    const employee: Employee = {
      ...mockEmployee,
      bwr_id: "0001234",
      bwr_submission_date: "2026-11-27",
    };
    const refreshed: Employee = { ...employee, bwr_status: "pending" };
    vi.mocked(employeeApi.updateEmployeeBwrStatus).mockResolvedValue(refreshed);
    renderPanel({ employee, onRefresh: vi.fn().mockResolvedValue(refreshed) });

    expect(screen.getByText("0001234")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: /^BWR ID$/i })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /save bwr status/i }));

    await waitFor(() => {
      expect(employeeApi.updateEmployeeBwrStatus).toHaveBeenCalledWith(
        "emp-1",
        { status: "pending", notes: null }
      );
    });
    expect(employeeApi.updateEmployee).not.toHaveBeenCalled();
  });

  it("keeps the pending status unavailable when a saved date cannot be refreshed", async () => {
    vi.mocked(employeeApi.updateEmployee).mockResolvedValue({
      ...mockEmployee,
      bwr_submission_date: "2026-11-27",
    });
    renderPanel();

    fireEvent.change(screen.getByLabelText(/^BWR Submission Date$/i), {
      target: { value: "2026-11-27" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: /save bwr submission date/i })
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The BWR change was saved, but the employee details could not be refreshed."
    );
    expect(
      screen.getByRole("button", { name: /save bwr status/i })
    ).toBeDisabled();
    expect(employeeApi.updateEmployeeBwrStatus).not.toHaveBeenCalled();
  });

  it("saves managed BWR status with Base UI fields and refreshes the panel", async () => {
    const activeEmployee: Employee = {
      ...mockEmployee,
      bwr_status: "pending",
      bwr_id: "1234567",
      bwr_notes: "Manual report sent",
    };
    const refreshedEmployee: Employee = {
      ...activeEmployee,
      bwr_status: "active",
      bwr_notes: "Approved",
    };
    const onRefresh = vi.fn().mockResolvedValue(refreshedEmployee);
    vi.mocked(employeeApi.updateEmployeeBwrStatus).mockResolvedValue(
      refreshedEmployee
    );

    renderPanel({ employee: activeEmployee, onRefresh });

    await selectOption(/^BWR Status$/i, /^Active$/i);
    fireEvent.change(screen.getByLabelText(/^BWR ID$/i), {
      target: { value: " 7654321 " },
    });
    fireEvent.change(screen.getByLabelText(/^BWR Notes$/i), {
      target: { value: " Approved " },
    });
    fireEvent.click(screen.getByRole("button", { name: /save bwr status/i }));

    await waitFor(() => {
      expect(employeeApi.updateEmployeeBwrStatus).toHaveBeenCalledWith(
        "emp-1",
        {
          status: "active",
          bwr_id: "7654321",
          notes: "Approved",
        }
      );
    });
    expect(onRefresh).toHaveBeenCalled();
    const success = screen.getByRole("status");
    expect(success).toHaveTextContent("BWR status updated.");
    expect(success).toHaveAttribute("data-slot", "alert");
    expect(success).toHaveClass("border-emerald-500/30", "bg-emerald-500/10");
    expect(success).toHaveClass("text-foreground");
    expect(success.className).not.toContain("text-emerald-700");
  });

  it("shows API validation errors on BWR fields with accessible invalid state", async () => {
    const activeEmployee: Employee = {
      ...mockEmployee,
      bwr_status: "pending",
      bwr_id: "",
      bwr_notes: "",
    };
    vi.mocked(employeeApi.updateEmployeeBwrStatus).mockRejectedValue(
      new ApiError("Validation failed", 422, {
        status: ["Status transition is not allowed."],
        bwr_id: ["BWR ID must contain seven digits."],
        notes: ["Notes may not exceed 1000 characters."],
      })
    );

    renderPanel({ employee: activeEmployee });

    await selectOption(/^BWR Status$/i, /^Active$/i);
    fireEvent.click(screen.getByRole("button", { name: /save bwr status/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Validation failed");
    });

    expect(
      screen.getByRole("combobox", { name: /^BWR Status$/i })
    ).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText(/^BWR ID$/i)).toHaveAttribute(
      "aria-describedby",
      "bwr-id-error"
    );
    expect(screen.getByLabelText(/^BWR Notes$/i)).toHaveAttribute(
      "aria-invalid",
      "true"
    );
    expect(
      screen.getByText("BWR ID must contain seven digits.")
    ).toBeInTheDocument();
  });

  it("renders localized read-only BWR guidance and migrated dark-mode surfaces", async () => {
    i18n.activate("de");

    renderPanel({
      canManage: false,
      employee: { ...mockEmployee, bwr_id: "0001234", bwr_notes: "Genehmigt" },
    });

    expect(screen.getByText("Bewacherregister")).toBeInTheDocument();
    expect(screen.getByText("0001234")).toBeInTheDocument();
    expect(screen.getByText("Genehmigt")).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(
      screen.getByText(
        /Sie können die BWR-Daten einsehen, aber zum Verwalten ist Schreibberechtigung erforderlich/i
      )
    ).toBeInTheDocument();
    const employeeStatusBadge = document.querySelector(
      '[data-slot="employee-status-badge"]'
    );
    const card = document.querySelector('[data-slot="card"]');

    expect(employeeStatusBadge).toBeInTheDocument();
    expect(employeeStatusBadge).toHaveClass(
      "bg-muted",
      "text-muted-foreground"
    );
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass("bg-card", "text-card-foreground");
  });

  it("keeps the BWR panel shell and feedback surfaces on canonical theme tokens", async () => {
    renderPanel();

    const heading = screen.getByRole("heading", { name: /bewacherregister/i });
    const copy = screen.getByText(
      /report the employee in the bewacherregister/i
    );
    expect(heading.closest("section")).toHaveClass("border-border");
    expect(copy).toHaveClass("text-muted-foreground");

    vi.mocked(employeeApi.updateEmployee).mockRejectedValueOnce(
      new ApiError("Invalid report date", 422, {
        bwr_submission_date: ["Enter a valid date."],
      })
    );

    const date = screen.getByLabelText(/^BWR Submission Date$/i);
    fireEvent.change(date, { target: { value: "2026-11-27" } });
    fireEvent.click(
      screen.getByRole("button", { name: /save bwr submission date/i })
    );

    const error = await screen.findByText("Invalid report date");
    expect(date).toHaveAttribute("aria-invalid", "true");
    expect(date).toHaveAccessibleDescription("Enter a valid date.");
    expect(error.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
    expect(error.closest('[data-slot="alert"]')).toHaveClass("text-foreground");
  });
});
