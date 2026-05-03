// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { messages as deMessages } from "../../../../src/locales/de/messages.mjs";
import { OnboardingWizard } from "../../../../src/pages/Onboarding/OnboardingWizard";
import * as onboardingApi from "../../../../src/services/onboardingApi";

vi.mock("../../../../src/services/onboardingApi");

function makeTemplate(
  id: string,
  title: string,
  description = `${title} description`,
  formSchema: Record<string, unknown> = {}
) {
  return {
    id,
    name: title,
    title,
    description,
    form_schema: formSchema,
    sort_order: Number(id.split("-")[1] ?? 1) * 10,
    step_number: Number(id.split("-")[1] ?? 1),
    is_required: true,
    is_system_template: true,
    can_be_deleted: false,
    can_be_edited: false,
  };
}

function makeSubmission(
  formTemplateId: string,
  formData: Record<string, unknown> = { legal_name: "Jane Doe" }
) {
  return {
    id: `submission-${formTemplateId}`,
    employee_id: "employee-1",
    form_template_id: formTemplateId,
    form_data: formData,
    status: "draft" as const,
    submitted_at: null,
    reviewed_by: null,
    reviewed_at: null,
    review_notes: null,
    form_template: null,
    reviewer: null,
    created_at: "2026-04-05T10:00:00Z",
    updated_at: "2026-04-05T10:00:00Z",
  };
}

function renderWizard() {
  return render(
    <I18nProvider i18n={i18n}>
      <OnboardingWizard />
    </I18nProvider>
  );
}

describe("OnboardingWizard", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    i18n.load("en", {});
    i18n.activate("en");

    vi.mocked(onboardingApi.fetchOnboardingSteps).mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Personal Information description",
        template_id: "template-1",
        is_completed: false,
        submission: makeSubmission("template-1"),
      },
      {
        step_number: 2,
        title: "Tax Details",
        description: "Tax Details description",
        template_id: "template-2",
        is_completed: false,
      },
    ]);

    vi.mocked(onboardingApi.fetchOnboardingTemplate)
      .mockResolvedValueOnce(makeTemplate("template-1", "Personal Information"))
      .mockResolvedValueOnce(makeTemplate("template-2", "Tax Details"));

    // step-1 has an existing submission, so saves go through updateOnboardingSubmission
    vi.mocked(onboardingApi.updateOnboardingSubmission).mockResolvedValue(
      makeSubmission("template-1")
    );
    vi.mocked(onboardingApi.uploadOnboardingFile).mockResolvedValue({
      id: "file-1",
      filename: "contract.pdf",
    });
  });

  it("loads the current runtime templates and advances after saving the active template draft", async () => {
    renderWizard();

    await waitFor(() => {
      expect(screen.getByText("Personal Information")).toBeInTheDocument();
    });

    expect(screen.queryByText("Contract Document")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    // step-1 has an existing submission — component PATCHes it via updateOnboardingSubmission
    await waitFor(() => {
      expect(onboardingApi.updateOnboardingSubmission).toHaveBeenCalledWith(
        "submission-template-1",
        { form_data: { legal_name: "Jane Doe" }, status: "draft" }
      );
    });

    await waitFor(() => {
      expect(screen.getByText("Tax Details")).toBeInTheDocument();
    });
  });

  it("shows inline success feedback when saving the current step as draft", async () => {
    renderWizard();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save draft/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    // step-1 has an existing submission — component PATCHes it via updateOnboardingSubmission
    await waitFor(() => {
      expect(onboardingApi.updateOnboardingSubmission).toHaveBeenCalledWith(
        "submission-template-1",
        { form_data: { legal_name: "Jane Doe" }, status: "draft" }
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText("Draft saved. You can continue later.")
      ).toBeInTheDocument();
    });
  });

  it("uploads onboarding attachments for the current editable step and shows inline upload feedback", async () => {
    const file = new File(["passport"], "passport.png", { type: "image/png" });
    vi.mocked(onboardingApi.uploadOnboardingFile).mockResolvedValueOnce({
      id: "file-2",
      filename: "passport.png",
    });

    renderWizard();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /upload file/i })
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Document Type"), {
      target: { value: "id_document" },
    });
    fireEvent.change(screen.getByLabelText("Attachment"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: /upload file/i }));

    await waitFor(() => {
      expect(onboardingApi.uploadOnboardingFile).toHaveBeenCalledWith(
        "submission-template-1",
        file,
        "id_document"
      );
    });

    expect(screen.getByText("File uploaded successfully.")).toBeInTheDocument();
    expect(screen.getByText("passport.png")).toBeInTheDocument();
    expect(screen.getAllByText("Identity Document")).toHaveLength(2);
  });

  it("localizes the generic upload fallback error and keeps the selected file for retry", async () => {
    const file = new File(["passport"], "passport.png", { type: "image/png" });
    i18n.load("de", deMessages);
    i18n.activate("de");
    vi.mocked(onboardingApi.uploadOnboardingFile).mockRejectedValueOnce(
      new Error("Failed to upload file")
    );

    renderWizard();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /datei hochladen/i })
      ).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Anhang"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: /datei hochladen/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Datei konnte nicht hochgeladen werden")
      ).toBeInTheDocument();
    });

    expect(screen.getByText("passport.png")).toBeInTheDocument();
  });

  it("disables step navigation and draft actions while an upload is in flight", async () => {
    let resolveUpload:
      | ((value: { id: string; filename: string }) => void)
      | null = null;

    vi.mocked(onboardingApi.fetchOnboardingSteps).mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Personal Information description",
        template_id: "template-1",
        is_completed: false,
        submission: makeSubmission("template-1"),
      },
      {
        step_number: 2,
        title: "Tax Details",
        description: "Tax Details description",
        template_id: "template-2",
        is_completed: false,
        submission: makeSubmission("template-2"),
      },
    ]);

    vi.mocked(onboardingApi.fetchOnboardingTemplate)
      .mockReset()
      .mockResolvedValueOnce(makeTemplate("template-1", "Personal Information"))
      .mockResolvedValueOnce(makeTemplate("template-2", "Tax Details"));

    vi.mocked(onboardingApi.uploadOnboardingFile).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpload = resolve;
        })
    );

    renderWizard();

    await waitFor(() => {
      expect(screen.getByText("Personal Information")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("Tax Details")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Attachment"), {
      target: {
        files: [new File(["tax"], "tax.pdf", { type: "application/pdf" })],
      },
    });
    fireEvent.click(screen.getByRole("button", { name: /upload file/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /uploading/i })).toBeDisabled();
    });

    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /save draft/i })).toBeDisabled();
    expect(
      screen.getByRole("button", { name: /submit for review/i })
    ).toBeDisabled();

    resolveUpload?.({ id: "file-3", filename: "tax.pdf" });

    await waitFor(() => {
      expect(
        screen.getByText("File uploaded successfully.")
      ).toBeInTheDocument();
    });
  });

  it("creates a draft before the first upload when the current step has no submission yet", async () => {
    const file = new File(["contract"], "contract.pdf", {
      type: "application/pdf",
    });

    vi.mocked(onboardingApi.fetchOnboardingSteps).mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Personal Information description",
        template_id: "template-1",
        is_completed: false,
      },
    ]);
    vi.mocked(onboardingApi.fetchOnboardingTemplate)
      .mockReset()
      .mockResolvedValue(
        makeTemplate("template-1", "Personal Information", undefined, {
          type: "object",
          properties: {
            legal_name: {
              type: "string",
              title: "Legal Name",
            },
          },
          required: [],
        })
      );
    vi.mocked(onboardingApi.createOnboardingSubmission).mockResolvedValue(
      makeSubmission("template-1", {
        legal_name: "Casey Example",
      })
    );

    renderWizard();

    await waitFor(() => {
      expect(screen.getByLabelText("Legal Name")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Legal Name"), {
      target: { value: "Casey Example" },
    });
    fireEvent.change(screen.getByLabelText("Attachment"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: /upload file/i }));

    await waitFor(() => {
      expect(onboardingApi.createOnboardingSubmission).toHaveBeenCalledWith({
        form_template_id: "template-1",
        form_data: { legal_name: "Casey Example" },
        status: "draft",
      });
    });

    await waitFor(() => {
      expect(onboardingApi.uploadOnboardingFile).toHaveBeenCalledWith(
        "submission-template-1",
        file,
        "contract"
      );
    });
  });

  it("shows only inline upload feedback when draft preparation fails before the first upload", async () => {
    const file = new File(["contract"], "contract.pdf", {
      type: "application/pdf",
    });

    vi.mocked(onboardingApi.fetchOnboardingSteps).mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Personal Information description",
        template_id: "template-1",
        is_completed: false,
      },
    ]);
    vi.mocked(onboardingApi.fetchOnboardingTemplate)
      .mockReset()
      .mockResolvedValue(
        makeTemplate("template-1", "Personal Information", undefined, {
          type: "object",
          properties: {
            legal_name: {
              type: "string",
              title: "Legal Name",
            },
          },
          required: [],
        })
      );
    vi.mocked(onboardingApi.createOnboardingSubmission).mockRejectedValueOnce(
      new Error("Failed to save draft")
    );

    renderWizard();

    await waitFor(() => {
      expect(screen.getByLabelText("Legal Name")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("Legal Name"), {
      target: { value: "Casey Example" },
    });
    fireEvent.change(screen.getByLabelText("Attachment"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("button", { name: /upload file/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "We couldn't prepare this step for file uploads. Please try saving your draft again."
        )
      ).toBeInTheDocument();
    });

    expect(screen.queryByText("Failed to save draft")).not.toBeInTheDocument();
  });

  it("submits the active step using the existing submission payload fallback", async () => {
    vi.mocked(onboardingApi.fetchOnboardingSteps).mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Personal Information description",
        template_id: "template-1",
        is_completed: false,
      },
      {
        step_number: 2,
        title: "Tax Details",
        description: "Tax Details description",
        template_id: "template-2",
        is_completed: false,
        submission: makeSubmission("template-2"),
      },
    ]);

    vi.mocked(onboardingApi.fetchOnboardingTemplate)
      .mockResolvedValueOnce(makeTemplate("template-1", "Personal Information"))
      .mockResolvedValueOnce(makeTemplate("template-2", "Tax Details"));

    // step-1 has no submission → first Next creates it; step-2 has a submission → Submit PATCHes it
    vi.mocked(onboardingApi.createOnboardingSubmission).mockResolvedValueOnce(
      makeSubmission("template-1")
    );
    vi.mocked(onboardingApi.updateOnboardingSubmission).mockResolvedValueOnce({
      ...makeSubmission("template-2"),
      status: "submitted",
    });

    renderWizard();

    await waitFor(() => {
      expect(screen.getByText("Personal Information")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("Tax Details")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));

    // step-2 has an existing submission — component PATCHes it using its stored form_data
    await waitFor(() => {
      expect(onboardingApi.updateOnboardingSubmission).toHaveBeenLastCalledWith(
        "submission-template-2",
        { form_data: { legal_name: "Jane Doe" }, status: "submitted" }
      );
    });

    await waitFor(() => {
      expect(
        screen.getByText(
          "Onboarding submitted. HR will review your information."
        )
      ).toBeInTheDocument();
    });
  });

  it("blocks submit for missing required schema fields and clears field errors as the user fixes them", async () => {
    const personalInformationSchema = {
      type: "object",
      required: ["gender", "nationalities", "intended_activities"],
      properties: {
        gender: {
          type: "string",
          title: "Gender",
          enum: ["female", "male"],
          enumNames: ["Female", "Male"],
        },
        nationalities: {
          type: "array",
          title: "Nationalities",
          items: {
            type: "string",
            enum: ["de", "fr"],
            enumNames: ["German", "French"],
          },
        },
        intended_activities: {
          type: "array",
          title: "Intended Activities",
        },
      },
    };

    vi.mocked(onboardingApi.fetchOnboardingSteps).mockResolvedValue([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Personal Information description",
        template_id: "template-1",
        is_completed: false,
        submission: makeSubmission("template-1", {
          gender: "female",
        }),
      },
    ]);

    vi.mocked(onboardingApi.fetchOnboardingTemplate)
      .mockReset()
      .mockResolvedValue(
        makeTemplate(
          "template-1",
          "Personal Information",
          "Personal Information description",
          personalInformationSchema
        )
      );

    renderWizard();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /submit for review/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "We couldn't submit the form yet. Please review the highlighted fields."
        )
      ).toBeInTheDocument();
      expect(screen.getAllByText("This field is required.")).toHaveLength(2);
    });

    expect(onboardingApi.updateOnboardingSubmission).not.toHaveBeenCalled();

    fireEvent.click(screen.getByLabelText("German"));

    await waitFor(() => {
      expect(screen.getAllByText("This field is required.")).toHaveLength(1);
    });
  });

  it("treats incomplete numeric input (e.g. '-') as unfilled for required number fields", async () => {
    const numericSchema = {
      type: "object",
      required: ["age"],
      properties: {
        age: {
          type: "integer",
          title: "Age",
        },
      },
    };

    vi.mocked(onboardingApi.fetchOnboardingSteps).mockResolvedValue([
      {
        step_number: 1,
        title: "Numeric Step",
        description: "Numeric Step description",
        template_id: "template-num",
        is_completed: false,
        submission: makeSubmission("template-num", {}),
      },
    ]);

    vi.mocked(onboardingApi.fetchOnboardingTemplate)
      .mockReset()
      .mockResolvedValue(
        makeTemplate(
          "template-num",
          "Numeric Step",
          "Numeric Step description",
          numericSchema
        )
      );

    renderWizard();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /submit for review/i })
      ).toBeInTheDocument();
    });

    const ageInput = screen.getByLabelText("Age");

    // Partial numeric input like "-" must not count as filled
    fireEvent.change(ageInput, { target: { value: "-" } });
    fireEvent.click(screen.getByRole("button", { name: /submit for review/i }));

    await waitFor(() => {
      expect(screen.getByText("This field is required.")).toBeInTheDocument();
    });

    expect(onboardingApi.updateOnboardingSubmission).not.toHaveBeenCalled();

    // A valid finite number must clear the error and allow submission
    fireEvent.change(ageInput, { target: { value: "30" } });

    await waitFor(() => {
      expect(
        screen.queryByText("This field is required.")
      ).not.toBeInTheDocument();
    });
  });

  it("keeps the user on the current step and shows an error when saving fails", async () => {
    // step-1 has an existing submission — rejection must come from updateOnboardingSubmission
    vi.mocked(onboardingApi.updateOnboardingSubmission).mockRejectedValueOnce(
      new Error("Database connection lost")
    );

    renderWizard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("Failed to save draft")).toBeInTheDocument();
    });
    expect(
      screen.queryByText("Database connection lost")
    ).not.toBeInTheDocument();

    expect(screen.queryByText("Tax Details")).not.toBeInTheDocument();
  });

  it("renders the template loading error inside the wizard when steps are already available", async () => {
    vi.mocked(onboardingApi.fetchOnboardingTemplate)
      .mockReset()
      .mockRejectedValueOnce(new Error("Backend template loader failed"));

    renderWizard();

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load form template")
      ).toBeInTheDocument();
    });
    expect(
      screen.queryByText("Backend template loader failed")
    ).not.toBeInTheDocument();

    expect(
      screen.getByText("Welcome to SecPal Onboarding")
    ).toBeInTheDocument();
  });
});
