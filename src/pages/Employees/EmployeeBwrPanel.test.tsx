// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

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
  exportEmployeeBwr: vi.fn(),
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
  organizational_unit: {
    id: "unit-1",
    name: "Engineering",
  },
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
  onRefresh?: () => Promise<Employee | null>;
  canManage?: boolean;
} = {}) {
  return render(
    <I18nProvider i18n={i18n}>
      <EmployeeBwrPanel
        employee={employee}
        canManage={canManage}
        onRefresh={onRefresh}
      />
    </I18nProvider>
  );
}

async function selectRadixOption(
  triggerName: RegExp,
  optionName: RegExp | string
) {
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

  it("renders download link for a safe HTTPS export URL", async () => {
    const safeUrl = "https://api.secpal.dev/v1/employees/emp-1/export.csv";
    vi.mocked(employeeApi.exportEmployeeBwr).mockResolvedValue({
      employee_id: "emp-1",
      status: "pending",
      format: "csv",
      download_url: safeUrl,
    });

    renderPanel();

    fireEvent.click(
      screen.getByRole("button", { name: /generate bwr export/i })
    );

    await waitFor(() => {
      expect(
        screen.getByRole("link", { name: /download latest export/i })
      ).toHaveAttribute("href", safeUrl);
    });

    expect(
      screen.getByText("BWR export generated. Download the file below.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([
    "javascript:alert('xss')",
    "data:text/html,<script>alert('xss')</script>",
  ])("blocks unsafe BWR export download URLs: %s", async (downloadUrl) => {
    vi.mocked(employeeApi.exportEmployeeBwr).mockResolvedValue({
      employee_id: "emp-1",
      status: "pending",
      format: "csv",
      download_url: downloadUrl,
    });

    renderPanel();

    fireEvent.click(
      screen.getByRole("button", { name: /generate bwr export/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "The export download link returned by the server is not safe to open."
        )
      ).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("link", { name: /download latest export/i })
    ).not.toBeInTheDocument();
    expect(document.querySelector('a[href^="javascript:"]')).toBeNull();
    expect(document.querySelector('a[href^="data:"]')).toBeNull();
  });

  it("saves managed BWR status with Radix fields and refreshes the panel", async () => {
    const activeEmployee: Employee = {
      ...mockEmployee,
      bwr_status: "pending",
      bwr_id: "1234567",
      bwr_notes: "Initial export sent",
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

    await selectRadixOption(/^BWR Status$/i, /^Active$/i);
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
        notes: ["Notes may not exceed 500 characters."],
      })
    );

    renderPanel({ employee: activeEmployee });

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

    renderPanel({ canManage: false });

    expect(screen.getByText("Bewacherregister")).toBeInTheDocument();
    expect(
      screen.getByText(
        /Sie können die BWR-Daten einsehen, aber zum Verwalten ist Schreibberechtigung erforderlich/i
      )
    ).toBeInTheDocument();
    expect(
      document.querySelector('[data-slot="employee-status-badge"]')
    ).toHaveClass("bg-muted", "text-muted-foreground");
    expect(document.querySelector('[data-slot="card"]')).toHaveClass(
      "bg-card",
      "text-card-foreground"
    );

    i18n.activate("en");
  });

  it("keeps the BWR panel shell and feedback surfaces on canonical theme tokens", async () => {
    renderPanel();

    const heading = screen.getByRole("heading", { name: /bewacherregister/i });
    const copy = screen.getByText(/manage the employee's bwr export/i);
    expect(heading.closest("section")).toHaveClass("border-border");
    expect(copy).toHaveClass("text-muted-foreground");

    vi.mocked(employeeApi.exportEmployeeBwr).mockRejectedValueOnce(
      new ApiError("Export failed", 500)
    );

    fireEvent.click(
      screen.getByRole("button", { name: /generate bwr export/i })
    );

    const error = await screen.findByText("Export failed");
    expect(error.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
    expect(error.closest('[data-slot="alert"]')).toHaveClass("text-foreground");
  });
});
