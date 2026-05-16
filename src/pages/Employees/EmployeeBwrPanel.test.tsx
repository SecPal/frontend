// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Employee } from "@/types/api";
import { messages as deMessages } from "../../locales/de/messages.mjs";
import { messages as enMessages } from "../../locales/en/messages.mjs";
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

function renderPanel(onRefresh = vi.fn().mockResolvedValue(null)) {
  return render(
    <I18nProvider i18n={i18n}>
      <EmployeeBwrPanel
        employee={mockEmployee}
        canManage={true}
        onRefresh={onRefresh}
      />
    </I18nProvider>
  );
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
});
