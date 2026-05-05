// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as deMessages } from "../../locales/de/messages.mjs";
import { messages as enMessages } from "../../locales/en/messages.mjs";
import type { Employee } from "@/types/api";
import { EmployeeContactsEdit } from "./EmployeeContactsEdit";
import * as employeeApi from "../../services/employeeApi";

vi.mock("../../services/employeeApi");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithProviders(employeeId: string) {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[`/employees/${employeeId}/edit/contacts`]}>
        <Routes>
          <Route
            path="/employees/:id/edit/contacts"
            element={<EmployeeContactsEdit />}
          />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
}

const mockEmployee: Employee = {
  id: "emp-1",
  employee_number: "E001",
  first_name: "Max",
  last_name: "Mustermann",
  full_name: "Max Mustermann",
  email: "max@mustermann.de",
  phone: "+491701234567",
  date_of_birth: "1990-01-01",
  contract_start_date: "2025-01-01",
  status: "active",
  contract_type: "full_time",
  organizational_unit: null,
  management_level: 0,
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

describe("EmployeeContactsEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", enMessages);
    i18n.load("de", deMessages);
    i18n.activate("en");
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(mockEmployee);
  });

  it("should navigate to employee profile when clicking employee name", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: "Max Mustermann" })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "Max Mustermann" }));

    expect(mockNavigate).toHaveBeenCalledWith("/employees/emp-1");
  });

  it("should navigate to employee profile when clicking employee number", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "E001" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: "E001" }));

    expect(mockNavigate).toHaveBeenCalledWith("/employees/emp-1");
  });

  it("should block editing when employee loading fails", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockRejectedValueOnce(
      new Error("Load failed")
    );

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Load failed");
    });

    expect(
      screen.queryByRole("button", { name: /^save$/i })
    ).not.toBeInTheDocument();
    expect(employeeApi.updateEmployee).not.toHaveBeenCalled();
  });
});
