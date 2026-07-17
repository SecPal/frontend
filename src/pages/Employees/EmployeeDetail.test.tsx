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
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as deMessages } from "../../locales/de/messages.mjs";
import { messages as enMessages } from "../../locales/en/messages.mjs";
import type { Employee } from "@/types/api";
import { EmployeeDetail } from "./EmployeeDetail";
import { ApiError } from "../../services/ApiError";
import * as employeeApi from "../../services/employeeApi";
import * as qualificationApi from "../../services/qualificationApi";
import * as documentApi from "../../services/employeeDocumentApi";

const { mockUseUserCapabilities } = vi.hoisted(() => ({
  mockUseUserCapabilities: vi.fn(),
}));

// Mock the API modules
vi.mock("../../services/employeeApi");
vi.mock("../../services/qualificationApi");
vi.mock("../../services/addressApi", () => ({
  fetchAddressStreetSuggestions: vi.fn().mockResolvedValue([]),
  fetchAddressLocalitySuggestions: vi.fn().mockResolvedValue([]),
}));
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
  addresses: [
    {
      id: "addr-default",
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
  created_at: "2025-01-01T00:00:00Z",
  updated_at: "2025-01-01T00:00:00Z",
};

describe("EmployeeDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", enMessages);
    i18n.load("de", deMessages);
    i18n.activate("en");
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

    // Setup default mocks
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(mockEmployee);
    vi.mocked(employeeApi.updateEmployee).mockResolvedValue(mockEmployee);
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
    expect(screen.getByText("Developer")).toBeInTheDocument();
    expect(screen.getByText("legal-entity-1")).toBeInTheDocument();
    expect(screen.getByText("establishment-1")).toBeInTheDocument();
    expect(screen.getByText("Sent")).toBeInTheDocument();
  });

  it("renders the migrated shadcn/Radix detail surface with dark-mode classes", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "John Doe" })
      ).toBeInTheDocument();
    });

    const detailCard = document.querySelector('[data-slot="card"]');
    expect(detailCard).toHaveClass("bg-card", "text-card-foreground");

    const statusBadge = document.querySelector(
      '[data-slot="employee-status-badge"]'
    );
    expect(statusBadge).toHaveClass("dark:bg-lime-400/10");

    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit email/i }));

    const dialogContent = await screen.findByRole("dialog", {
      name: /edit email/i,
    });
    expect(dialogContent).toHaveAttribute("data-slot", "dialog-content");
    expect(dialogContent).toHaveClass("bg-background", "text-foreground");
    expect(screen.getByLabelText(/^email$/i)).toHaveAttribute(
      "data-slot",
      "input"
    );
  });

  it("should render contact details in the contacts tab", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^contact$/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));

    expect(screen.getByText("john.doe@secpal.dev")).toBeInTheDocument();
    expect(screen.getByText("+1234567890")).toBeInTheDocument();
    expect(
      screen.getByText("No postal address stored yet.")
    ).toBeInTheDocument();
    expect(
      screen.getByText("No emergency contacts stored yet.")
    ).toBeInTheDocument();
  });

  it("keeps detail secondary text and muted contact empty states on canonical theme tokens", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "John Doe" })
      ).toBeInTheDocument();
    });

    const employeeNumber = screen.getAllByText("E001")[0];
    expect(employeeNumber).toHaveClass("text-muted-foreground");

    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));

    expect(screen.getByText("No postal address stored yet.")).toHaveClass(
      "text-muted-foreground"
    );
    expect(screen.getByText("No emergency contacts stored yet.")).toHaveClass(
      "text-muted-foreground"
    );
  });

  it("renders a subsection skeleton while qualifications load", async () => {
    vi.mocked(qualificationApi.fetchEmployeeQualifications).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^qualifications$/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^qualifications$/i }));

    expect(
      screen.getByRole("status", {
        name: /loading employee qualifications/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "John Doe" })
    ).toBeInTheDocument();
  });

  it("should open contacts tab when URL hash is #contacts", async () => {
    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/employees/emp-1#contacts"]}>
          <Routes>
            <Route path="/employees/:id" element={<EmployeeDetail />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("john.doe@secpal.dev")).toBeInTheDocument();
    });
  });

  it("should allow switching tabs after loading from #contacts hash", async () => {
    render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={["/employees/emp-1#contacts"]}>
          <Routes>
            <Route path="/employees/:id" element={<EmployeeDetail />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("john.doe@secpal.dev")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^profile$/i }));

    await waitFor(() => {
      expect(screen.queryByText("john.doe@secpal.dev")).not.toBeInTheDocument();
    });
    expect(screen.getByText("BWR Status")).toBeInTheDocument();
  });

  it("should edit email from the contacts tab row overlay", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^contact$/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit email/i }));

    await waitFor(() => {
      expect(screen.getByText("Edit Email")).toBeInTheDocument();
    });

    const input = screen.getByDisplayValue("john.doe@secpal.dev");
    fireEvent.change(input, { target: { value: "max@mustermann.de" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(employeeApi.updateEmployee).toHaveBeenCalledWith("emp-1", {
        email: "max@mustermann.de",
      });
    });
  });

  it("should edit postal address from the contacts tab row overlay", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^contact$/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /edit postal address/i })
    );

    await waitFor(() => {
      expect(screen.getByText("Edit Postal Address")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^Street$/i), {
      target: { value: "Musterstraße" },
    });
    fireEvent.change(screen.getByLabelText(/^House Number$/i), {
      target: { value: "12A" },
    });
    fireEvent.change(screen.getByLabelText(/^Postal Code$/i), {
      target: { value: "10115" },
    });
    fireEvent.change(screen.getByLabelText(/^City$/i), {
      target: { value: "Berlin" },
    });
    // Country is now a searchable combobox; the default draft country (DE) is kept
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(employeeApi.updateEmployee).toHaveBeenCalledWith("emp-1", {
        addresses: [
          {
            street: "Musterstraße",
            house_number: "12A",
            postal_code: "10115",
            city: "Berlin",
            supplement: null,
            country: "DE",
            state: null,
            resided_from: null,
            resided_until: null,
          },
        ],
      });
    });
  });

  it("should edit emergency contacts from the contacts tab row overlay", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^contact$/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));

    const editPhoneButton = screen.getByRole("button", { name: /edit phone/i });
    expect(editPhoneButton).toHaveClass("text-muted-foreground");
    expect(editPhoneButton.className).not.toContain("text-zinc-500");

    fireEvent.click(
      screen.getByRole("button", { name: /edit emergency contacts/i })
    );

    await waitFor(() => {
      expect(screen.getByText("Edit Emergency Contacts")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^Emergency Contact Name$/i), {
      target: { value: "Maria Mustermann" },
    });
    fireEvent.change(screen.getByLabelText(/^Emergency Contact Phone$/i), {
      target: { value: "+491234567890" },
    });
    fireEvent.change(
      screen.getByLabelText(/^Emergency Contact Relationship$/i),
      {
        target: { value: "Sister" },
      }
    );
    fireEvent.change(screen.getByLabelText(/^Emergency Contact Email$/i), {
      target: { value: "maria@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(employeeApi.updateEmployee).toHaveBeenCalledWith("emp-1", {
        emergency_contacts: [
          {
            name: "Maria Mustermann",
            relationship: "Sister",
            phone: "+491234567890",
            email: "maria@example.com",
            notes: null,
          },
        ],
      });
    });
  });

  it("should trim emergency contact email before validating in dialog edit flow", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^contact$/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /edit emergency contacts/i })
    );

    await waitFor(() => {
      expect(screen.getByText("Edit Emergency Contacts")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/^Emergency Contact Name$/i), {
      target: { value: "Maria Mustermann" },
    });
    fireEvent.change(screen.getByLabelText(/^Emergency Contact Phone$/i), {
      target: { value: "+491234567890" },
    });
    fireEvent.change(screen.getByLabelText(/^Emergency Contact Email$/i), {
      target: { value: " maria@example.com " },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(employeeApi.updateEmployee).toHaveBeenCalledWith("emp-1", {
        emergency_contacts: [
          {
            name: "Maria Mustermann",
            relationship: null,
            phone: "+491234567890",
            email: "maria@example.com",
            notes: null,
          },
        ],
      });
    });
  });

  it("should mark inline email input invalid when trying to save an empty value", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^contact$/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit email/i }));

    await waitFor(() => {
      expect(screen.getByText("Edit Email")).toBeInTheDocument();
    });

    const emailInput = screen.getByDisplayValue("john.doe@secpal.dev");
    fireEvent.change(emailInput, { target: { value: "" } });
    fireEvent.submit(
      document.querySelector("form.contents") as HTMLFormElement
    );

    await waitFor(() => {
      expect(emailInput).toHaveAttribute("aria-invalid", "true");
    });
    expect(employeeApi.updateEmployee).not.toHaveBeenCalled();
  });

  it("should validate emergency contact fields and support add/remove in dialog edit flow", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^contact$/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /edit emergency contacts/i })
    );

    await waitFor(() => {
      expect(screen.getByText("Edit Emergency Contacts")).toBeInTheDocument();
    });
    vi.spyOn(HTMLFormElement.prototype, "reportValidity").mockReturnValue(true);
    const dialogForm = document.querySelector(
      "form.contents"
    ) as HTMLFormElement;

    fireEvent.click(screen.getByRole("button", { name: /add contact/i }));
    expect(screen.getAllByLabelText(/^Emergency Contact Name$/i)).toHaveLength(
      2
    );

    const emergencyName = screen.getAllByLabelText(
      /^Emergency Contact Name$/i
    )[0]!;
    const emergencyPhone = screen.getAllByLabelText(
      /^Emergency Contact Phone$/i
    )[0]!;
    const emergencyEmail = screen.getAllByLabelText(
      /^Emergency Contact Email$/i
    )[0]!;
    const emergencyNotes = screen.getAllByLabelText(
      /^Emergency Contact Notes$/i
    )[0]!;

    fireEvent.change(emergencyPhone, { target: { value: "+49111111111" } });
    fireEvent.submit(dialogForm);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Emergency contact name is required."
      );
    });
    expect(emergencyName).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(emergencyName, { target: { value: "Maria Muster" } });
    fireEvent.change(emergencyPhone, { target: { value: "" } });
    fireEvent.submit(dialogForm);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Emergency contact phone is required."
      );
    });
    expect(emergencyPhone).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(emergencyPhone, { target: { value: "+49111111111" } });
    fireEvent.change(emergencyEmail, { target: { value: "broken-email" } });
    fireEvent.submit(dialogForm);
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Please enter a valid emergency contact email."
      );
    });
    expect(emergencyEmail).toHaveAttribute("aria-invalid", "true");

    fireEvent.change(emergencyEmail, {
      target: { value: "maria@example.com" },
    });
    fireEvent.change(emergencyNotes, {
      target: { value: "Reach after 18:00" },
    });
    fireEvent.click(
      screen.getAllByRole("button", { name: /remove contact/i })[0]!
    );
    expect(screen.getAllByLabelText(/^Emergency Contact Name$/i)).toHaveLength(
      1
    );
  });

  it("should show fallback error when contact field update fails with unknown error", async () => {
    vi.mocked(employeeApi.updateEmployee).mockRejectedValueOnce({});

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^contact$/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));
    fireEvent.click(screen.getByRole("button", { name: /edit phone/i }));

    await waitFor(() => {
      expect(screen.getByText("Edit Phone")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue("+1234567890"), {
      target: { value: "+491701234567" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to update contact field."
      );
    });
  });

  it("should clear dialog errors when closing with cancel", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^contact$/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /edit emergency contacts/i })
    );

    await waitFor(() => {
      expect(screen.getByText("Edit Emergency Contacts")).toBeInTheDocument();
    });
    vi.spyOn(HTMLFormElement.prototype, "reportValidity").mockReturnValue(true);
    const dialogForm = document.querySelector(
      "form.contents"
    ) as HTMLFormElement;

    fireEvent.change(screen.getByLabelText(/^Emergency Contact Phone$/i), {
      target: { value: "+491701112233" },
    });
    fireEvent.submit(dialogForm);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Emergency contact name is required."
      );
    });

    fireEvent.click(screen.getAllByRole("button", { name: /^cancel$/i })[0]!);

    await waitFor(() => {
      expect(
        screen.queryByText("Emergency contact name is required.")
      ).not.toBeInTheDocument();
    });
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
      legal_entity_id: "legal-entity-1",
      establishment_id: "establishment-1",
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "John Doe" })
      ).toBeInTheDocument();
    });

    expect(screen.getAllByText("-").length).toBeGreaterThanOrEqual(3);
  });

  it("should render the BWR management panel with export controls", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      bwr_notes: "Awaiting initial Bewacherregister export",
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /bewacherregister/i })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /bewacherregister/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /bewacherregister/i })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Not registered")).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /export format/i })
    ).toHaveTextContent("CSV");
    expect(
      screen.getByRole("button", { name: /generate bwr export/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Awaiting initial Bewacherregister export")
    ).toBeInTheDocument();
  });

  it("should generate a BWR export and refresh the employee", async () => {
    vi.mocked(employeeApi.fetchEmployee)
      .mockResolvedValueOnce({
        ...mockEmployee,
        bwr_status: "not_registered",
      })
      .mockResolvedValueOnce({
        ...mockEmployee,
        bwr_status: "pending",
        bwr_submission_date: "2025-01-02",
      });

    vi.mocked(employeeApi.exportEmployeeBwr).mockResolvedValue({
      employee_id: "emp-1",
      status: "pending",
      format: "xml",
      download_url:
        "https://api.secpal.dev/v1/employees/emp-1/bwr/exports/export.xml/download",
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /bewacherregister/i })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /bewacherregister/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /generate bwr export/i })
      ).toBeInTheDocument();
    });

    await selectRadixOption(/export format/i, /^XML$/i);
    fireEvent.click(
      screen.getByRole("button", { name: /generate bwr export/i })
    );

    await waitFor(() => {
      expect(employeeApi.exportEmployeeBwr).toHaveBeenCalledWith(
        "emp-1",
        "xml"
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/bwr export generated/i)).toBeInTheDocument();
    });

    const downloadLink = screen.getByRole("link", {
      name: /download latest export/i,
    });
    expect(downloadLink).toHaveAttribute(
      "href",
      "https://api.secpal.dev/v1/employees/emp-1/bwr/exports/export.xml/download"
    );
  });

  it("should show export readiness validation errors in the BWR panel", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue(mockEmployee);
    vi.mocked(employeeApi.exportEmployeeBwr).mockRejectedValue(
      new ApiError("Employee is not ready for BWR export.", 422, {
        general: ["gender", "birth_city"],
      })
    );

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /bewacherregister/i })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /bewacherregister/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /generate bwr export/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /generate bwr export/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText("Employee is not ready for BWR export.")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("gender")).toBeInTheDocument();
    expect(screen.getByText("birth_city")).toBeInTheDocument();
  });

  it("should update the BWR status and refresh the employee", async () => {
    vi.mocked(employeeApi.fetchEmployee)
      .mockResolvedValueOnce({
        ...mockEmployee,
        bwr_status: "pending",
      })
      .mockResolvedValueOnce({
        ...mockEmployee,
        bwr_status: "active",
        bwr_id: "1234567",
        bwr_registered_at: "2025-01-03T10:30:00Z",
        bwr_notes: "Registration confirmed by authority",
      });

    vi.mocked(employeeApi.updateEmployeeBwrStatus).mockResolvedValue({
      ...mockEmployee,
      bwr_status: "active",
      bwr_id: "1234567",
      bwr_registered_at: "2025-01-03T10:30:00Z",
      bwr_notes: "Registration confirmed by authority",
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /bewacherregister/i })
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /bewacherregister/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/^BWR Status$/i)).toBeInTheDocument();
    });

    await selectRadixOption(/^BWR Status$/i, /^Active$/i);
    fireEvent.change(screen.getByLabelText(/^BWR ID$/i), {
      target: { value: "1234567" },
    });
    fireEvent.change(screen.getByLabelText(/^BWR Notes$/i), {
      target: { value: "Registration confirmed by authority" },
    });
    fireEvent.click(screen.getByRole("button", { name: /save bwr status/i }));

    await waitFor(() => {
      expect(employeeApi.updateEmployeeBwrStatus).toHaveBeenCalledWith(
        "emp-1",
        {
          status: "active",
          bwr_id: "1234567",
          notes: "Registration confirmed by authority",
        }
      );
    });

    await waitFor(() => {
      expect(screen.getByText(/bwr status updated/i)).toBeInTheDocument();
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

    expect(screen.getByRole("alert")).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
    expect(screen.getByRole("alert")).toHaveClass("text-foreground");
    expect(screen.getByText(/error loading employee/i)).toHaveAttribute(
      "data-slot",
      "alert-title"
    );
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

  it("should use contacts edit page from top edit button in contacts tab", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^contact$/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));
    const editLink = screen.getByRole("link", { name: /^edit$/i });
    expect(editLink).toHaveAttribute("href", "/employees/emp-1/edit/contacts");
  });

  it("should display loading state", () => {
    vi.mocked(employeeApi.fetchEmployee).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithProviders("emp-1");

    expect(
      screen.getByRole("status", { name: /loading employee details/i })
    ).toBeInTheDocument();
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
      onboarding_completed: true,
      onboarding_workflow: {
        status: "ready_for_activation" as const,
      },
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

  it("should show confirm onboarding button for submitted onboarding dossiers", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      status: "pre_contract",
      onboarding_completed: true,
      onboarding_workflow: {
        status: "submitted_for_review",
      },
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /confirm onboarding/i })
      ).toBeInTheDocument();
    });
  });

  it("should translate confirm onboarding button text to German", async () => {
    await act(async () => {
      i18n.activate("de");
    });

    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      status: "pre_contract",
      onboarding_completed: true,
      onboarding_workflow: {
        status: "submitted_for_review",
      },
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /onboarding bestätigen/i })
      ).toBeInTheDocument();
    });

    await act(async () => {
      i18n.activate("en");
    });
  });

  it("should confirm onboarding dossier and reload the employee", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    vi.mocked(employeeApi.fetchEmployee)
      .mockResolvedValueOnce({
        ...mockEmployee,
        status: "pre_contract",
        onboarding_completed: true,
        onboarding_workflow: {
          status: "submitted_for_review",
        },
      })
      .mockResolvedValueOnce({
        ...mockEmployee,
        status: "pre_contract",
        onboarding_completed: true,
        onboarding_workflow: {
          status: "ready_for_activation",
        },
      });

    vi.mocked(employeeApi.confirmEmployeeOnboarding).mockResolvedValue({
      ...mockEmployee,
      status: "pre_contract",
      onboarding_completed: true,
      onboarding_workflow: {
        status: "ready_for_activation",
      },
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /confirm onboarding/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /confirm onboarding/i })
    );

    await waitFor(() => {
      expect(employeeApi.confirmEmployeeOnboarding).toHaveBeenCalledWith(
        "emp-1",
        undefined
      );
    });

    vi.restoreAllMocks();
  });

  it("should display Error failures from confirm onboarding", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      status: "pre_contract",
      onboarding_completed: true,
      onboarding_workflow: {
        status: "submitted_for_review",
      },
    });

    vi.mocked(employeeApi.confirmEmployeeOnboarding).mockRejectedValueOnce(
      new Error("Confirm failed")
    );

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /confirm onboarding/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /confirm onboarding/i })
    );

    await waitFor(() => {
      expect(screen.getByText("Confirm failed")).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  it("should display object-message failures from confirm onboarding", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      status: "pre_contract",
      onboarding_completed: true,
      onboarding_workflow: {
        status: "submitted_for_review",
      },
    });

    vi.mocked(employeeApi.confirmEmployeeOnboarding).mockRejectedValueOnce({
      message: "Object confirm failure",
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /confirm onboarding/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(
      screen.getByRole("button", { name: /confirm onboarding/i })
    );

    await waitFor(() => {
      expect(screen.getByText("Object confirm failure")).toBeInTheDocument();
    });

    vi.restoreAllMocks();
  });

  it("should show terminate button for on-leave employees", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      status: "on_leave",
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByText("On Leave")).toBeInTheDocument();
    });

    expect(
      screen.getByRole("button", { name: /terminate/i })
    ).toBeInTheDocument();
  });

  it("should explain when onboarding invitations are unavailable for the current status", async () => {
    vi.mocked(employeeApi.fetchEmployee).mockResolvedValue({
      ...mockEmployee,
      status: "active",
      onboarding_invitation: {
        status: "not_requested",
        requested_at: null,
        token_created_at: null,
        mail_sent_at: null,
        mail_failed_at: null,
        failure_reason: null,
        available: false,
        eligible_statuses: ["pre_contract"],
        rule_message:
          "Onboarding invitations are only available while the employee is in pre_contract status.",
      },
    });

    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(screen.getByText("Not requested")).toBeInTheDocument();
    });

    expect(
      screen.getByText(
        /onboarding invitations are only available while the employee is in pre_contract status\./i
      )
    ).toBeInTheDocument();
  });

  it("should switch between tabs", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: "John Doe" })
      ).toBeInTheDocument();
    });

    // Initially on Profile tab
    expect(screen.getByRole("button", { name: /^profile$/i })).toHaveClass(
      "border-primary",
      "text-foreground"
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

    expect(qualificationsTab).toHaveClass("border-primary", "text-foreground");
    expect(screen.getByRole("button", { name: /^profile$/i })).toHaveClass(
      "text-muted-foreground"
    );
  });

  it("should display no qualifications message on canonical muted tokens", async () => {
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

    expect(screen.getByText(/no qualifications assigned/i)).toHaveClass(
      "text-muted-foreground"
    );
  });

  it("should display no documents message on Documents tab with canonical muted tokens", async () => {
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

    expect(screen.getByText(/no documents uploaded/i)).toHaveClass(
      "text-muted-foreground"
    );
  });

  it("keeps emergency contact editor cards on canonical border tokens", async () => {
    renderWithProviders("emp-1");

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /^contact$/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /^contact$/i }));
    fireEvent.click(
      screen.getByRole("button", { name: /edit emergency contacts/i })
    );

    await waitFor(() => {
      expect(screen.getByText("Edit Emergency Contacts")).toBeInTheDocument();
    });

    const editorCard = screen
      .getByLabelText(/^Emergency Contact Name$/i)
      .closest("div.rounded-md");

    expect(editorCard).toHaveClass("border-border");
    expect(editorCard).not.toHaveClass(
      "border-zinc-200",
      "dark:border-zinc-800"
    );
  });

  it("should handle non-Error object errors on activate", async () => {
    const preContractEmployee = {
      ...mockEmployee,
      status: "pre_contract" as const,
      onboarding_completed: true,
      onboarding_workflow: {
        status: "ready_for_activation" as const,
      },
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
          confirmOnboarding: false,
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

      // Should NOT display the management badge markup
      expect(screen.queryByText(/^ML\s+\d+$/)).not.toBeInTheDocument();
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
