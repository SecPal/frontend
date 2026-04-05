// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OnboardingWizard } from "../../../../src/pages/Onboarding/OnboardingWizard";
import * as onboardingApi from "../../../../src/services/onboardingApi";

vi.mock("../../../../src/services/onboardingApi");

function makeTemplate(
  id: string,
  title: string,
  description = `${title} description`
) {
  return {
    id,
    name: title,
    title,
    description,
    form_schema: {},
    sort_order: Number(id.split("-")[1] ?? 1) * 10,
    step_number: Number(id.split("-")[1] ?? 1),
    is_required: true,
    is_system_template: true,
    can_be_deleted: false,
    can_be_edited: false,
  };
}

function makeSubmission(formTemplateId: string) {
  return {
    id: `submission-${formTemplateId}`,
    employee_id: "employee-1",
    form_template_id: formTemplateId,
    form_data: { legal_name: "Jane Doe" },
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
    vi.stubGlobal("alert", vi.fn());

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

    vi.mocked(onboardingApi.createOnboardingSubmission).mockResolvedValue(
      makeSubmission("template-1")
    );
  });

  it("loads the current runtime templates and advances after saving the active template draft", async () => {
    renderWizard();

    await waitFor(() => {
      expect(screen.getByText("Personal Information")).toBeInTheDocument();
    });

    expect(screen.queryByText("Contract Document")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(onboardingApi.createOnboardingSubmission).toHaveBeenCalledWith({
        form_template_id: "template-1",
        form_data: { legal_name: "Jane Doe" },
        status: "draft",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Tax Details")).toBeInTheDocument();
    });
  });

  it("shows a success alert when saving the current step as draft", async () => {
    renderWizard();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /save draft/i })
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /save draft/i }));

    await waitFor(() => {
      expect(onboardingApi.createOnboardingSubmission).toHaveBeenCalledWith({
        form_template_id: "template-1",
        form_data: { legal_name: "Jane Doe" },
        status: "draft",
      });
    });

    expect(globalThis.alert).toHaveBeenCalledWith("Draft saved successfully!");
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

    vi.mocked(onboardingApi.createOnboardingSubmission)
      .mockResolvedValueOnce(makeSubmission("template-1"))
      .mockResolvedValueOnce({
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

    await waitFor(() => {
      expect(onboardingApi.createOnboardingSubmission).toHaveBeenLastCalledWith(
        {
          form_template_id: "template-2",
          form_data: { legal_name: "Jane Doe" },
          status: "submitted",
        }
      );
    });

    expect(globalThis.alert).toHaveBeenCalledWith(
      "Onboarding submitted successfully! HR will review your submission."
    );
  });

  it("keeps the user on the current step and shows an error when saving fails", async () => {
    vi.mocked(onboardingApi.createOnboardingSubmission).mockRejectedValueOnce(
      new Error("Failed to save draft")
    );

    renderWizard();

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => {
      expect(screen.getByText("Failed to save draft")).toBeInTheDocument();
    });

    expect(globalThis.alert).not.toHaveBeenCalled();
  });

  it("renders the template loading error inside the wizard when steps are already available", async () => {
    vi.mocked(onboardingApi.fetchOnboardingTemplate)
      .mockReset()
      .mockRejectedValueOnce(new Error("Failed to load form template"));

    renderWizard();

    await waitFor(() => {
      expect(
        screen.getByText("Failed to load form template")
      ).toBeInTheDocument();
    });

    expect(
      screen.getByText("Welcome to SecPal Onboarding")
    ).toBeInTheDocument();
  });
});
