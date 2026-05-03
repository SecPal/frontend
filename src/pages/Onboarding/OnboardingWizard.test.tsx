// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OnboardingWizard } from "./OnboardingWizard";

const onboardingApiMocks = vi.hoisted(() => ({
  createOnboardingSubmission: vi.fn(),
  fetchOnboardingSteps: vi.fn(),
  fetchOnboardingTemplate: vi.fn(),
  uploadOnboardingFile: vi.fn(),
  updateOnboardingSubmission: vi.fn(),
}));

vi.mock("../../services/onboardingApi", () => onboardingApiMocks);

function renderWithProviders() {
  return render(
    <MemoryRouter>
      <I18nProvider i18n={i18n}>
        <OnboardingWizard />
      </I18nProvider>
    </MemoryRouter>
  );
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");

    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Tell us who you are.",
        template_id: "template-1",
        is_completed: false,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {
            birth_name: "Lovelace",
            gender: "female",
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValue({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          birth_name: {
            type: "string",
            title: "Birth Name",
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });

    onboardingApiMocks.createOnboardingSubmission.mockResolvedValue({
      id: "submission-1",
      employee_id: "employee-1",
      form_template_id: "template-1",
      form_data: {
        birth_name: "Ada",
      },
      status: "draft",
      created_at: "2026-04-30T00:00:00Z",
      updated_at: "2026-04-30T00:00:00Z",
    });

    onboardingApiMocks.updateOnboardingSubmission.mockResolvedValue({
      id: "submission-1",
      employee_id: "employee-1",
      form_template_id: "template-1",
      form_data: {
        birth_name: "Ada",
        gender: "female",
      },
      status: "draft",
      created_at: "2026-04-30T00:00:00Z",
      updated_at: "2026-04-30T00:00:00Z",
    });
    onboardingApiMocks.uploadOnboardingFile.mockResolvedValue({
      id: "file-1",
      filename: "contract.pdf",
    });
  });

  it("renders schema fields, prefills the draft submission, and updates existing drafts without alerts", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    const birthNameInput = await screen.findByLabelText(/birth name/i);
    expect(birthNameInput).toHaveValue("Lovelace");
    expect(screen.getByLabelText(/gender/i)).toHaveValue("female");

    await user.clear(birthNameInput);
    await user.type(birthNameInput, "Ada");
    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(
        onboardingApiMocks.updateOnboardingSubmission
      ).toHaveBeenCalledWith(
        "submission-1",
        expect.objectContaining({
          status: "draft",
          form_data: expect.objectContaining({
            birth_name: "Ada",
            gender: "female",
          }),
        })
      );
    });

    expect(
      onboardingApiMocks.createOnboardingSubmission
    ).not.toHaveBeenCalled();
    expect(alertSpy).not.toHaveBeenCalled();
    expect(await screen.findByRole("status")).toHaveTextContent(/draft saved/i);

    alertSpy.mockRestore();
  });
});

describe("OnboardingWizard optional emergency contact schema", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");

    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Emergency Contact",
        description: "Optional emergency contacts.",
        template_id: "template-emergency",
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValue({
      id: "template-emergency",
      name: "Emergency Contact",
      title: "Emergency Contact",
      description: "Optional emergency contact persons",
      form_schema: {
        title: "Emergency Contact",
        description: "Optional emergency contact persons",
        type: "object",
        required: [],
        properties: {
          contact_1_name: {
            type: "string",
            title: "Contact 1: Name",
            maxLength: 100,
          },
          contact_1_phone: {
            type: "string",
            title: "Contact 1: Phone",
          },
          contact_1_relationship: {
            type: "string",
            title: "Contact 1: Relationship",
            enum: ["spouse", "friend"],
          },
        },
      },
      is_required: false,
      is_system_template: true,
      sort_order: 3,
      can_be_deleted: false,
      can_be_edited: false,
    });

    onboardingApiMocks.createOnboardingSubmission.mockResolvedValue({
      id: "submission-emergency",
      employee_id: "employee-1",
      form_template_id: "template-emergency",
      form_data: {},
      status: "submitted",
      created_at: "2026-04-30T00:00:00Z",
      updated_at: "2026-04-30T00:00:00Z",
    });
  });

  it("does not mark emergency contact fields required and submits empty data", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/^Optional$/)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /skip this step/i })
    ).not.toBeInTheDocument();

    expect(screen.getByLabelText(/contact 1: name/i)).not.toHaveAttribute(
      "required"
    );
    expect(screen.getByLabelText(/contact 1: phone/i)).not.toHaveAttribute(
      "required"
    );
    expect(screen.getByLabelText(/contact 1: relationship/i)).not.toHaveAttribute(
      "required"
    );

    await user.click(screen.getByRole("button", { name: /submit for review/i }));

    await waitFor(() => {
      expect(onboardingApiMocks.createOnboardingSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          form_template_id: "template-emergency",
          status: "submitted",
          form_data: {},
        })
      );
    });
  });
});

describe("OnboardingWizard optional intended activities (BWR)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");

    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Your details.",
        template_id: "template-personal",
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValue({
      id: "template-personal",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "Personal details for onboarding.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["male", "female", "diverse"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["DE", "AT"],
            },
          },
          intended_activities: {
            type: "array",
            title: "Intended Activities",
            items: {
              type: "string",
              enum: ["door_control", "event_security"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 1,
      can_be_deleted: false,
      can_be_edited: false,
    });

    onboardingApiMocks.createOnboardingSubmission.mockResolvedValue({
      id: "submission-personal",
      employee_id: "employee-1",
      form_template_id: "template-personal",
      form_data: {
        gender: "female",
        nationalities: ["DE"],
      },
      status: "submitted",
      created_at: "2026-04-30T00:00:00Z",
      updated_at: "2026-04-30T00:00:00Z",
    });
  });

  it("does not require intended activities for Submit for Review when schema omits them from required", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await user.click(screen.getByLabelText(/^DE$/));

    await user.click(screen.getByRole("button", { name: /submit for review/i }));

    await waitFor(() => {
      expect(onboardingApiMocks.createOnboardingSubmission).toHaveBeenCalledWith(
        expect.objectContaining({
          form_template_id: "template-personal",
          status: "submitted",
          form_data: expect.objectContaining({
            gender: "female",
            nationalities: ["DE"],
          }),
        })
      );
    });

    const call = onboardingApiMocks.createOnboardingSubmission.mock.calls[0]?.[0];
    expect(call?.form_data).not.toHaveProperty("intended_activities");
  });
});
