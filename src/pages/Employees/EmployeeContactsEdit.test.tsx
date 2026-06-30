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
vi.mock("../../services/addressApi", () => ({
  fetchAddressStreetSuggestions: vi.fn().mockResolvedValue([]),
  fetchAddressLocalitySuggestions: vi.fn().mockResolvedValue([]),
}));

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

async function waitForLoadedForm() {
  await waitFor(() => {
    expect(screen.getByRole("button", { name: /^save$/i })).toBeInTheDocument();
  });
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
  addresses: [
    {
      id: "addr-1",
      street: null,
      house_number: null,
      postal_code: null,
      city: null,
      supplement: null,
      country: null,
      state: null,
      resided_from: null,
      resided_until: null,
    },
  ],
  structured_address: null,
  emergency_contacts: null,
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

  it("keeps the contact edit frame visible while employee data loads", () => {
    vi.mocked(employeeApi.fetchEmployee).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders("emp-1");

    expect(screen.getByText("Edit Contact Details")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /back to employee/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading employee contact form/i })
    ).toBeInTheDocument();
    expect(
      document.querySelectorAll('[data-slot="skeleton"]').length
    ).toBeGreaterThan(0);
  });

  it("should navigate to employee profile when clicking employee name", async () => {
    renderWithProviders("emp-1");

    await waitForLoadedForm();

    fireEvent.click(screen.getByRole("button", { name: "Max Mustermann" }));

    expect(mockNavigate).toHaveBeenCalledWith("/employees/emp-1");
  });

  it("should navigate to employee profile when clicking employee number", async () => {
    renderWithProviders("emp-1");

    await waitForLoadedForm();

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

  it("should show fallback error for non-Error load failures", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockRejectedValueOnce("broken");

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to load employee"
      );
    });
  });

  it("should navigate back to contacts hash from cancel", async () => {
    renderWithProviders("emp-1");
    await waitForLoadedForm();

    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(mockNavigate).toHaveBeenCalledWith("/employees/emp-1#contacts");
  });

  it("should render prefilled contact, address and emergency values", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValueOnce({
      ...mockEmployee,
      addresses: [
        {
          id: "addr-1",
          street: "Musterstraße",
          house_number: "7A",
          postal_code: "10115",
          city: "Berlin",
          supplement: "Hinterhaus",
          state: "Berlin",
          country: "DE",
          resided_from: null,
          resided_until: null,
        },
      ],
      structured_address: "Musterstraße 7A, Hinterhaus, 10115 Berlin, DE",
      emergency_contacts: [
        {
          name: "Eva Mustermann",
          relationship: "Sister",
          phone: "+491701112233",
          email: "eva@example.com",
          notes: "Nur tagsüber",
        },
      ],
    });

    renderWithProviders("emp-1");
    await waitForLoadedForm();

    expect(screen.getByDisplayValue("Musterstraße")).toBeInTheDocument();
    expect(screen.getByDisplayValue("7A")).toBeInTheDocument();
    expect(screen.getByDisplayValue("10115")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("Berlin").length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Hinterhaus")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /country/i })
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Eva Mustermann")).toBeInTheDocument();
    expect(screen.getByDisplayValue("+491701112233")).toBeInTheDocument();
    expect(screen.getByDisplayValue("eva@example.com")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Nur tagsüber")).toBeInTheDocument();
  });

  it("should validate required email and mark the email input invalid", async () => {
    renderWithProviders("emp-1");
    await waitForLoadedForm();

    const emailInput = screen.getByDisplayValue("max@mustermann.de");
    fireEvent.change(emailInput, { target: { value: "" } });
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Email address is required"
      );
    });
    expect(emailInput).toHaveAttribute("aria-invalid", "true");
  });

  it("should validate email format and block saving invalid email", async () => {
    renderWithProviders("emp-1");
    await waitForLoadedForm();

    const emailInput = screen.getByDisplayValue("max@mustermann.de");
    fireEvent.change(emailInput, { target: { value: "invalid-email" } });
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Please enter a valid email address"
      );
    });
    expect(employeeApi.updateEmployee).not.toHaveBeenCalled();
  });

  it("should validate emergency contact name, phone and email fields", async () => {
    renderWithProviders("emp-1");
    await waitForLoadedForm();

    const emergencyName = screen.getByLabelText(/^Emergency Contact Name$/i);
    const emergencyPhone = screen.getByLabelText(/^Emergency Contact Phone$/i);
    const emergencyEmail = screen.getByLabelText(/^Emergency Contact Email$/i);

    fireEvent.change(emergencyPhone, { target: { value: "+491701112233" } });
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Emergency contact name is required."
      );
    });
    expect(emergencyName).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(emergencyName, { target: { value: "Eva Muster" } });
    fireEvent.change(emergencyPhone, { target: { value: "" } });
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Emergency contact phone is required."
      );
    });
    expect(emergencyPhone).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(emergencyPhone, { target: { value: "+491701112233" } });
    fireEvent.change(emergencyEmail, { target: { value: "not-an-email" } });
    fireEvent.submit(document.querySelector("form") as HTMLFormElement);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Please enter a valid emergency contact email."
      );
    });
    expect(emergencyEmail).toHaveAttribute("aria-invalid", "true");
  });

  it("should add and remove emergency contact rows", async () => {
    renderWithProviders("emp-1");
    await waitForLoadedForm();

    expect(screen.getAllByLabelText(/^Emergency Contact Name$/i)).toHaveLength(
      1
    );
    fireEvent.click(screen.getByRole("button", { name: /add contact/i }));
    expect(screen.getAllByLabelText(/^Emergency Contact Name$/i)).toHaveLength(
      2
    );

    fireEvent.click(
      screen.getAllByRole("button", { name: /remove contact/i })[0]!
    );
    expect(screen.getAllByLabelText(/^Emergency Contact Name$/i)).toHaveLength(
      1
    );

    fireEvent.click(screen.getByRole("button", { name: /remove contact/i }));
    expect(screen.getAllByLabelText(/^Emergency Contact Name$/i)).toHaveLength(
      1
    );
  });

  it("should not submit the form when adding or removing emergency contacts", async () => {
    renderWithProviders("emp-1");
    await waitForLoadedForm();

    fireEvent.click(screen.getByRole("button", { name: /add contact/i }));
    fireEvent.click(
      screen.getAllByRole("button", { name: /remove contact/i })[0]!
    );

    expect(employeeApi.updateEmployee).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith("/employees/emp-1#contacts");
  });

  it("should save normalized payload and navigate to contacts tab", async () => {
    vi.mocked(employeeApi.updateEmployee).mockResolvedValueOnce({
      ...mockEmployee,
      email: "new@example.com",
    });

    renderWithProviders("emp-1");
    await waitForLoadedForm();

    fireEvent.change(screen.getByDisplayValue("max@mustermann.de"), {
      target: { value: "  new@example.com " },
    });
    fireEvent.change(screen.getByDisplayValue("+491701234567"), {
      target: { value: " +491709998887 " },
    });
    fireEvent.change(screen.getByLabelText("Street"), {
      target: { value: " Hauptstraße " },
    });
    fireEvent.change(screen.getByLabelText("House Number"), {
      target: { value: " 4b " },
    });
    fireEvent.change(screen.getByLabelText("Postal Code"), {
      target: { value: " 50667 " },
    });
    fireEvent.change(screen.getByLabelText("City"), {
      target: { value: " Köln " },
    });
    fireEvent.change(screen.getByLabelText("Address Supplement"), {
      target: { value: " Etage 2 " },
    });
    fireEvent.change(screen.getByLabelText(/^Emergency Contact Name$/i), {
      target: { value: " Eva Muster " },
    });
    fireEvent.change(
      screen.getByLabelText(/^Emergency Contact Relationship$/i),
      {
        target: { value: " Schwester " },
      }
    );
    fireEvent.change(screen.getByLabelText(/^Emergency Contact Phone$/i), {
      target: { value: " +491701112233 " },
    });
    fireEvent.change(screen.getByLabelText(/^Emergency Contact Email$/i), {
      target: { value: " eva@example.com " },
    });
    fireEvent.change(screen.getByLabelText(/^Emergency Contact Notes$/i), {
      target: { value: " tagsüber " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(employeeApi.updateEmployee).toHaveBeenCalledWith("emp-1", {
        email: "new@example.com",
        phone: "+491709998887",
        addresses: [
          {
            street: "Hauptstraße",
            house_number: "4b",
            postal_code: "50667",
            city: "Köln",
            supplement: "Etage 2",
            state: null,
            country: null,
            resided_from: null,
            resided_until: null,
          },
        ],
        emergency_contacts: [
          {
            name: "Eva Muster",
            relationship: "Schwester",
            phone: "+491701112233",
            email: "eva@example.com",
            notes: "tagsüber",
          },
        ],
      });
    });
    expect(mockNavigate).toHaveBeenCalledWith("/employees/emp-1#contacts");
  });

  it("should show save errors from update failures", async () => {
    vi.mocked(employeeApi.updateEmployee).mockRejectedValueOnce(
      new Error("Update failed")
    );

    renderWithProviders("emp-1");
    await waitForLoadedForm();

    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Update failed");
    });
    expect(mockNavigate).not.toHaveBeenCalledWith("/employees/emp-1#contacts");

    vi.mocked(employeeApi.updateEmployee).mockRejectedValueOnce("failed");
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to update employee"
      );
    });
  });
});
