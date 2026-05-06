// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ApiError } from "../../services/ApiError";
import { OnboardingWizard } from "./OnboardingWizard";

const onboardingApiMocks = vi.hoisted(() => ({
  createOnboardingSubmission: vi.fn(),
  fetchOnboardingNationalityOptions: vi.fn(),
  fetchOnboardingSteps: vi.fn(),
  fetchOnboardingTemplate: vi.fn(),
  uploadOnboardingFile: vi.fn(),
  updateOnboardingSubmission: vi.fn(),
}));

vi.mock("../../services/onboardingApi", () => onboardingApiMocks);

function renderWithProviders() {
  return render(
    <MemoryRouter initialEntries={["/onboarding"]}>
      <I18nProvider i18n={i18n}>
        <Routes>
          <Route path="/onboarding" element={<OnboardingWizard />} />
          <Route
            path="/onboarding/submitted"
            element={
              <div>
                <h1>You&apos;re all set</h1>
              </div>
            }
          />
        </Routes>
      </I18nProvider>
    </MemoryRouter>
  );
}

async function selectNationality(
  user: ReturnType<typeof userEvent.setup>,
  query = "de"
) {
  const nationalityControl = screen.getByLabelText(/^nationalities$/i);

  if (nationalityControl instanceof HTMLSelectElement) {
    await user.selectOptions(nationalityControl, "DE");
    return;
  }

  const nationalityInput = nationalityControl as HTMLInputElement;
  await user.click(nationalityInput);
  await user.clear(nationalityInput);
  await user.type(nationalityInput, query);
  await user.keyboard("{ArrowDown}{Enter}");
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
        is_required: true,
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
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValue([
      { code: "DE", name: "Germany" },
      { code: "PL", name: "Poland" },
    ]);
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

  it("opens the completion page when onboarding was already submitted", async () => {
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Tell us who you are.",
        template_id: "template-1",
        is_required: true,
        is_completed: true,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {
            birth_name: "Lovelace",
            gender: "female",
          },
          status: "submitted",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /you're all set/i })
    ).toBeInTheDocument();
  });

  it("requires residence title confirmation for non-exempt nationalities", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockResolvedValueOnce([
      { code: "TR", name: "Turkey" },
    ]);
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
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
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["TR"],
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

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user, "tr");

    expect(
      screen.getByLabelText(/residence title type/i)
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/employment permitted/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByLabelText(/unlimited residence title/i)
    ).not.toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(await screen.findAllByText("This field is required.")).toHaveLength(2);

    await user.selectOptions(
      screen.getByLabelText(/residence title type/i),
      "Aufenthaltserlaubnis"
    );

    const expiryInput = screen.getByLabelText(/residence title valid until/i);
    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );
    expect(await screen.findAllByText("This field is required.")).toHaveLength(2);
    await user.type(expiryInput, "2000-01-01");
    await user.selectOptions(
      screen.getByLabelText(/employment permitted/i),
      "no"
    );

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );
    expect(
      await screen.findByText(
        "A valid residence title without employment authorization cannot be accepted. Please contact HR."
      )
    ).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText(/employment permitted/i),
      "yes"
    );
    await user.clear(expiryInput);
    await user.type(expiryInput, "2030-12-31");

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    await waitFor(() => {
      expect(
        onboardingApiMocks.updateOnboardingSubmission
      ).toHaveBeenCalledWith(
        "submission-1",
        expect.objectContaining({
          form_data: expect.objectContaining({
            residence_permit_title: "Aufenthaltserlaubnis",
            residence_permit_employment_allowed: "yes",
            residence_permit_unlimited: false,
            residence_permit_expiry: "2030-12-31",
          }),
        })
      );
    });
  });

  it("shows an explicit error when nationality options cannot be loaded", async () => {
    onboardingApiMocks.fetchOnboardingNationalityOptions.mockRejectedValueOnce(
      new Error("network")
    );
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["nationalities"],
        properties: {
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
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

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();
    expect(
      await screen.findByText(
        /nationality options could not be loaded right now/i
      )
    ).toBeInTheDocument();

    const nationalitySelect = screen.getByLabelText(/^nationalities$/i);
    expect(nationalitySelect).toBeDisabled();
  });

  it("keeps document type selection available when nationalities is only required", async () => {
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    const documentTypeSelect = screen.getByLabelText(/document type/i);
    expect(documentTypeSelect).toBeInTheDocument();
    expect(documentTypeSelect).toHaveValue("contract");
  });

  it("normalizes nationality payloads to a single value before saving", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-1",
      name: "Personal Information Form",
      title: "Personal Information Form",
      description: "BewachV information required for registration.",
      form_schema: {
        title: "Personal Information Form",
        type: "object",
        required: ["nationalities"],
        properties: {
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["DE", "TR"],
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
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValueOnce([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Tell us who you are.",
        template_id: "template-1",
        is_required: true,
        is_completed: false,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: {
            nationalities: ["DE", "TR"],
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
    ]);

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(
        onboardingApiMocks.updateOnboardingSubmission
      ).toHaveBeenCalledWith(
        "submission-1",
        expect.objectContaining({
          status: "draft",
          form_data: expect.objectContaining({
            nationalities: ["DE"],
          }),
        })
      );
    });
  });

  it("shows the API validation message when a file upload is rejected", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.uploadOnboardingFile.mockRejectedValue(
      new ApiError("The file must be a PDF, JPG, or PNG", 422, {})
    );

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();

    const attachmentInput = await screen.findByLabelText(/attachment/i);
    await user.upload(
      attachmentInput,
      new File(["invalid"], "document.pdf", { type: "application/pdf" })
    );

    await user.click(screen.getByRole("button", { name: /upload file/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The file must be a PDF, JPG, or PNG"
    );
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
        is_required: false,
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
          contact_2_name: {
            type: "string",
            title: "Contact 2: Name",
            maxLength: 100,
          },
          contact_2_phone: {
            type: "string",
            title: "Contact 2: Phone",
          },
          contact_2_relationship: {
            type: "string",
            title: "Contact 2: Relationship",
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
    expect(
      screen.getByLabelText(/contact 1: relationship/i)
    ).not.toHaveAttribute("required");

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    await waitFor(() => {
      expect(
        onboardingApiMocks.createOnboardingSubmission
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          form_template_id: "template-emergency",
          status: "submitted",
          form_data: {},
        })
      );
    });

    expect(
      await screen.findByRole("heading", { name: /you're all set/i })
    ).toBeInTheDocument();
  });

  it("shows the second emergency contact only after the first contact has details", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    expect(screen.queryByLabelText(/contact 2: name/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/contact 2: phone/i)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/contact 2: relationship/i)
    ).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/contact 1: name/i), "Ada Lovelace");

    expect(screen.getByLabelText(/contact 2: name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/contact 2: phone/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/contact 2: relationship/i)
    ).toBeInTheDocument();
  });

  it("keeps document type selection available on steps without nationality fields", async () => {
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    const documentTypeSelect = screen.getByLabelText(/document type/i);
    expect(documentTypeSelect).toBeInTheDocument();
    expect(documentTypeSelect).toHaveValue("contract");
  });

  it("requires a phone number for each emergency contact with a name", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/contact 1: phone/i)).not.toHaveAttribute(
      "required"
    );

    await user.type(screen.getByLabelText(/contact 1: name/i), "Ada Lovelace");

    expect(screen.getByLabelText(/contact 1: phone/i)).toBeRequired();

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText("This field is required.")
    ).toBeInTheDocument();
    expect(
      onboardingApiMocks.createOnboardingSubmission
    ).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/contact 1: phone/i), "+491234567");
    await user.type(screen.getByLabelText(/contact 2: name/i), "Grace Hopper");

    expect(screen.getByLabelText(/contact 2: phone/i)).toBeRequired();

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText("This field is required.")
    ).toBeInTheDocument();
    expect(
      onboardingApiMocks.createOnboardingSubmission
    ).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText(/contact 2: phone/i), "+499876543");
    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    await waitFor(() => {
      expect(
        onboardingApiMocks.createOnboardingSubmission
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          form_template_id: "template-emergency",
          status: "submitted",
          form_data: expect.objectContaining({
            contact_1_name: "Ada Lovelace",
            contact_1_phone: "+491234567",
            contact_2_name: "Grace Hopper",
            contact_2_phone: "+499876543",
          }),
        })
      );
    });
  });

  it("keeps second-contact data when first-contact details are temporarily cleared", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/contact 1: name/i), "Ada Lovelace");
    await user.type(screen.getByLabelText(/contact 2: name/i), "Grace Hopper");
    await user.type(screen.getByLabelText(/contact 2: phone/i), "+499876543");

    await user.clear(screen.getByLabelText(/contact 1: name/i));
    await user.type(screen.getByLabelText(/contact 1: name/i), "Ada Lovelace");

    expect(screen.getByLabelText(/contact 2: name/i)).toHaveValue(
      "Grace Hopper"
    );
    expect(screen.getByLabelText(/contact 2: phone/i)).toHaveValue(
      "+499876543"
    );
  });

  it("clears conditional phone required errors when the corresponding contact name is removed", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/contact 1: name/i), "Ada Lovelace");
    await user.type(screen.getByLabelText(/contact 1: phone/i), "+491234567");
    await user.type(screen.getByLabelText(/contact 2: name/i), "Grace Hopper");

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText("This field is required.")
    ).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/contact 2: name/i));

    await waitFor(() => {
      expect(
        screen.queryByText("This field is required.")
      ).not.toBeInTheDocument();
    });
  });
});

describe("OnboardingWizard HR-managed intended activities (BWR)", () => {
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
        is_required: true,
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
        required: ["gender", "nationalities", "intended_activities"],
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

  it("does not show or submit intended activities in employee onboarding", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information form/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/intended activities/i)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user);

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    await waitFor(() => {
      expect(
        onboardingApiMocks.createOnboardingSubmission
      ).toHaveBeenCalledWith(
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

    const call =
      onboardingApiMocks.createOnboardingSubmission.mock.calls[0]?.[0];
    expect(call?.form_data).not.toHaveProperty("intended_activities");

    expect(
      await screen.findByRole("heading", { name: /you're all set/i })
    ).toBeInTheDocument();
  });
});

describe("OnboardingWizard server-side validation feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("en", {});
    i18n.activate("en");

    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Bank Account Details",
        description: "Salary payment.",
        template_id: "template-bank",
        is_required: false,
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValue({
      id: "template-bank",
      name: "Bank Account Details",
      title: "Bank Account Details",
      description: "Bank info",
      form_schema: {
        type: "object",
        required: ["iban", "account_holder"],
        properties: {
          iban: {
            type: "string",
            title: "IBAN",
          },
          account_holder: {
            type: "string",
            title: "Account Holder",
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 2,
      can_be_deleted: false,
      can_be_edited: false,
    });
  });

  it("shows API field validation messages inline after Submit for Review", async () => {
    onboardingApiMocks.createOnboardingSubmission.mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        "form_data.iban": ["The string does not match the required pattern."],
      })
    );

    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /bank account details/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^iban$/i), "DE44500105175407324931");
    await user.type(screen.getByLabelText(/^account holder$/i), "Ada Lovelace");

    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(/IBAN: Please use the required format/i)
    ).toBeInTheDocument();
  });

  it("names the affected array field when the API rejects a nested value", async () => {
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-bank",
      name: "Personal Information",
      title: "Personal Information",
      description: "Personal details",
      form_schema: {
        type: "object",
        required: ["gender", "nationalities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["female", "male"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["DE", "FR"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 2,
      can_be_deleted: false,
      can_be_edited: false,
    });
    onboardingApiMocks.createOnboardingSubmission.mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        form_data: ["The string should match pattern: ^[A-Z]{2}$"],
        "form_data.nationalities.0": [
          "The string should match pattern: ^[A-Z]{2}$",
        ],
      })
    );

    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user);
    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(
        "Nationalities: Use a two-letter country code in uppercase, for example DE."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "We couldn't submit the form yet. Please review the highlighted fields."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText("The string should match pattern: ^[A-Z]{2}$")
    ).not.toBeInTheDocument();
  });

  it("rewrites global pattern validation messages with the affected field name", async () => {
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-bank",
      name: "Personal Information",
      title: "Personal Information",
      description: "Personal details",
      form_schema: {
        type: "object",
        required: ["birth_country"],
        properties: {
          birth_country: {
            type: "string",
            title: "Birth Country",
            pattern: "^[A-Z]{2}$",
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 2,
      can_be_deleted: false,
      can_be_edited: false,
    });
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information/i })
    ).toBeInTheDocument();

    await user.type(screen.getByLabelText(/^birth country$/i), "D1");
    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(
        "Birth Country: Use a two-letter country code in uppercase, for example DE."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText("The string should match pattern: ^[A-Z]{2}$")
    ).not.toBeInTheDocument();
    expect(
      onboardingApiMocks.createOnboardingSubmission
    ).not.toHaveBeenCalled();
  });

  it("shows supplemental feedback when API errors target hidden HR-managed fields", async () => {
    onboardingApiMocks.fetchOnboardingTemplate.mockResolvedValueOnce({
      id: "template-bank",
      name: "Personal Information",
      title: "Personal Information",
      description: "Personal details",
      form_schema: {
        type: "object",
        required: ["gender", "nationalities", "intended_activities"],
        properties: {
          gender: {
            type: "string",
            title: "Gender",
            enum: ["female", "male"],
          },
          nationalities: {
            type: "array",
            title: "Nationalities",
            items: {
              type: "string",
              enum: ["DE", "FR"],
            },
          },
          intended_activities: {
            type: "array",
            title: "Intended Activities",
            items: {
              type: "string",
              enum: ["door_control"],
            },
          },
        },
      },
      is_required: true,
      is_system_template: true,
      sort_order: 2,
      can_be_deleted: false,
      can_be_edited: false,
    });
    onboardingApiMocks.createOnboardingSubmission.mockRejectedValueOnce(
      new ApiError("The given data was invalid.", 422, {
        form_data: ["Submission contains HR-managed fields."],
        "form_data.intended_activities": ["The selected value is invalid."],
      })
    );

    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information/i })
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText(/^gender$/i), "female");
    await selectNationality(user);
    await user.click(
      screen.getByRole("button", { name: /submit for review/i })
    );

    expect(
      await screen.findByText(
        "form_data: Submission contains HR-managed fields."
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        "We couldn't submit the form yet. Please review the highlighted fields."
      )
    ).not.toBeInTheDocument();
  });
});

describe("OnboardingWizard skip step behavior", () => {
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
        is_required: false,
        is_completed: false,
        submission: null,
      },
      {
        step_number: 2,
        title: "Bank Account Details",
        description: "Salary payment.",
        template_id: "template-bank",
        is_required: true,
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockImplementation(
      async (templateId: string) => {
        if (templateId === "template-emergency") {
          return {
            id: "template-emergency",
            name: "Emergency Contact",
            title: "Emergency Contact",
            description: "Optional emergency contact persons",
            form_schema: {
              title: "Emergency Contact",
              type: "object",
              required: [],
              properties: {
                contact_1_name: {
                  type: "string",
                  title: "Contact 1: Name",
                  maxLength: 100,
                },
              },
            },
            is_required: false,
            is_system_template: true,
            sort_order: 1,
            can_be_deleted: false,
            can_be_edited: false,
          };
        }

        return {
          id: "template-bank",
          name: "Bank Account Details",
          title: "Bank Account Details",
          description: "Bank info",
          form_schema: {
            type: "object",
            required: ["iban"],
            properties: {
              iban: { type: "string", title: "IBAN" },
            },
          },
          is_required: true,
          is_system_template: true,
          sort_order: 2,
          can_be_deleted: false,
          can_be_edited: false,
        };
      }
    );
  });

  it("advances to the next step without creating a submission when Skip this step is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    const skipButton = screen.getByRole("button", { name: /skip this step/i });
    expect(skipButton).toBeInTheDocument();

    await user.click(skipButton);

    expect(
      await screen.findByRole("heading", { name: /bank account details/i })
    ).toBeInTheDocument();

    expect(
      onboardingApiMocks.createOnboardingSubmission
    ).not.toHaveBeenCalled();
  });

  it("allows skipping optional steps even when existing draft values do not match pattern rules", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Emergency Contact",
        description: "Optional emergency contacts.",
        template_id: "template-emergency",
        is_required: false,
        is_completed: false,
        submission: {
          id: "submission-emergency",
          employee_id: "employee-1",
          form_template_id: "template-emergency",
          form_data: {
            contact_1_country: "d1",
          },
          status: "draft",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
      {
        step_number: 2,
        title: "Bank Account Details",
        description: "Salary payment.",
        template_id: "template-bank",
        is_required: true,
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockImplementation(
      async (templateId: string) => {
        if (templateId === "template-emergency") {
          return {
            id: "template-emergency",
            name: "Emergency Contact",
            title: "Emergency Contact",
            description: "Optional emergency contact persons",
            form_schema: {
              title: "Emergency Contact",
              type: "object",
              required: [],
              properties: {
                contact_1_country: {
                  type: "string",
                  title: "Contact 1: Country",
                  pattern: "^[A-Z]{2}$",
                },
              },
            },
            is_required: false,
            is_system_template: true,
            sort_order: 1,
            can_be_deleted: false,
            can_be_edited: false,
          };
        }

        return {
          id: "template-bank",
          name: "Bank Account Details",
          title: "Bank Account Details",
          description: "Bank info",
          form_schema: {
            type: "object",
            required: ["iban"],
            properties: {
              iban: { type: "string", title: "IBAN" },
            },
          },
          is_required: true,
          is_system_template: true,
          sort_order: 2,
          can_be_deleted: false,
          can_be_edited: false,
        };
      }
    );

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /emergency contact/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /skip this step/i }));

    expect(
      await screen.findByRole("heading", { name: /bank account details/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/Use a two-letter country code in uppercase/i)
    ).not.toBeInTheDocument();
  });

  it("allows advancing from read-only steps without running required-field validation", async () => {
    const user = userEvent.setup();
    onboardingApiMocks.fetchOnboardingSteps.mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Submitted already.",
        template_id: "template-read-only",
        is_required: true,
        is_completed: true,
        submission: {
          id: "submission-read-only",
          employee_id: "employee-1",
          form_template_id: "template-read-only",
          form_data: {},
          status: "submitted",
          created_at: "2026-04-30T00:00:00Z",
          updated_at: "2026-04-30T00:00:00Z",
        },
      },
      {
        step_number: 2,
        title: "Bank Account Details",
        description: "Salary payment.",
        template_id: "template-bank",
        is_required: true,
        is_completed: false,
        submission: null,
      },
    ]);

    onboardingApiMocks.fetchOnboardingTemplate.mockImplementation(
      async (templateId: string) => {
        if (templateId === "template-read-only") {
          return {
            id: "template-read-only",
            name: "Personal Information",
            title: "Personal Information",
            description: "Read-only schema",
            form_schema: {
              type: "object",
              required: ["gender"],
              properties: {
                gender: { type: "string", title: "Gender" },
              },
            },
            is_required: true,
            is_system_template: true,
            sort_order: 1,
            can_be_deleted: false,
            can_be_edited: false,
          };
        }

        return {
          id: "template-bank",
          name: "Bank Account Details",
          title: "Bank Account Details",
          description: "Bank info",
          form_schema: {
            type: "object",
            required: ["iban"],
            properties: {
              iban: { type: "string", title: "IBAN" },
            },
          },
          is_required: true,
          is_system_template: true,
          sort_order: 2,
          can_be_deleted: false,
          can_be_edited: false,
        };
      }
    );

    renderWithProviders();

    expect(
      await screen.findByRole("heading", { name: /personal information/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(
      await screen.findByRole("heading", { name: /bank account details/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByText("This field is required.")
    ).not.toBeInTheDocument();
    expect(
      onboardingApiMocks.createOnboardingSubmission
    ).not.toHaveBeenCalled();
    expect(
      onboardingApiMocks.updateOnboardingSubmission
    ).not.toHaveBeenCalled();
  });
});
