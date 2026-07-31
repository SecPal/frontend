// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { expect, test } from "./auth.setup";
import { isRemoteE2ETarget } from "./auth-helpers";

const countryTemplate = {
  id: "template-country",
  name: "Country Details",
  title: "Country Details",
  description: "Country Details description",
  form_schema: {
    type: "object",
    required: ["country_code"],
    properties: {
      country_code: {
        type: "string",
        title: "Country Code",
        pattern: "^[A-Z]{2}$",
      },
    },
  },
  is_required: true,
  is_system_template: true,
  sort_order: 1,
  can_be_deleted: false,
  can_be_edited: false,
};

const finalTemplate = {
  id: "template-final",
  name: "Final Review",
  title: "Final Review",
  description: "Final Review description",
  form_schema: {
    type: "object",
    required: ["legal_name"],
    properties: {
      legal_name: {
        type: "string",
        title: "Legal Name",
      },
    },
  },
  is_required: true,
  is_system_template: true,
  sort_order: 2,
  can_be_deleted: false,
  can_be_edited: false,
};

const countrySubmission = {
  id: "submission-country",
  employee_id: "employee-1",
  form_template_id: countryTemplate.id,
  form_data: {
    country_code: "DE",
  },
  status: "draft",
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

const finalSubmission = {
  id: "submission-final",
  employee_id: "employee-1",
  form_template_id: finalTemplate.id,
  form_data: {
    legal_name: "Jane Doe",
  },
  status: "draft",
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

const onboardingEmployee = {
  id: "employee-1",
  first_name: "Jane",
  last_name: "Doe",
  contract_start_date: "2026-05-01",
  status: "pre_contract",
};
const onboardingNationalities = [
  { code: "DE", name: "German" },
  { code: "TR", name: "Turkish" },
];

const personalInformationTemplate = {
  id: "template-personal-information",
  name: "Personal Information",
  title: "Personal Information",
  description: "Personal information required for registration.",
  form_schema: {
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
};

const personalInformationSubmission = {
  id: "submission-personal-information",
  employee_id: onboardingEmployee.id,
  form_template_id: personalInformationTemplate.id,
  form_data: {
    gender: "female",
    nationalities: ["TR"],
  },
  status: "draft",
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
};

type WizardTemplate =
  | typeof countryTemplate
  | typeof finalTemplate
  | typeof personalInformationTemplate;
type WizardSubmission =
  | typeof countrySubmission
  | typeof finalSubmission
  | typeof personalInformationSubmission;

interface WizardRouteScenario {
  templates: ReadonlyArray<WizardTemplate>;
  submissions: ReadonlyArray<WizardSubmission>;
}

const patternValidationScenario: WizardRouteScenario = {
  templates: [countryTemplate, finalTemplate],
  submissions: [countrySubmission, finalSubmission],
};

async function installWizardValidationRoutes(
  context: import("@playwright/test").BrowserContext,
  scenario: WizardRouteScenario = patternValidationScenario
) {
  await context.route("**/v1/onboarding/templates", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: scenario.templates,
      }),
    });
  });

  await context.route("**/v1/onboarding/templates/*", async (route) => {
    const templateId = route.request().url().split("/").at(-1);

    const template =
      scenario.templates.find((entry) => entry.id === templateId) ?? null;

    if (!template) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Template not found" }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: template }),
    });
  });

  await context.route("**/v1/onboarding/submissions", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: scenario.submissions,
      }),
    });
  });

  await context.route("**/v1/employees/*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: onboardingEmployee,
      }),
    });
  });

  await context.route("**/v1/onboarding/nationalities", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: onboardingNationalities,
      }),
    });
  });

  await context.route("**/v1/onboarding/submissions/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.fallback();
      return;
    }

    const requestBody = route.request().postDataJSON() as
      { status?: string; form_data?: Record<string, unknown> } | undefined;
    const submissionId = route.request().url().split("/").at(-1);
    const submission = scenario.submissions.find(
      (entry) => entry.id === submissionId
    );

    if (!submission) {
      await route.fulfill({
        status: 404,
        contentType: "application/json",
        body: JSON.stringify({ message: "Submission not found" }),
      });
      return;
    }

    if (
      submission.id === countrySubmission.id &&
      requestBody?.status === "draft"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: countrySubmission }),
      });
      return;
    }

    if (
      submission.id === countrySubmission.id &&
      requestBody?.status === "submitted"
    ) {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          message: "The string should match pattern: ^[A-Z]{2}$",
        }),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          ...submission,
          status: requestBody?.status ?? submission.status,
          form_data: requestBody?.form_data ?? submission.form_data,
        },
      }),
    });
  });
}

test.describe("Onboarding wizard validation", () => {
  test("uses the failed step schema when formatting cross-step pattern validation errors", async ({
    authenticatedPage: page,
  }) => {
    test.skip(
      isRemoteE2ETarget(),
      "Deterministic wizard validation coverage relies on local route mocks."
    );

    await installWizardValidationRoutes(page.context());

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /^Country Details$/i })
    ).toBeVisible();

    await page.getByRole("button", { name: /next/i }).click();

    await expect(
      page.getByRole("heading", { name: /^Final Review$/i })
    ).toBeVisible();

    await page.getByRole("button", { name: /submit for review/i }).click();

    await expect(
      page.getByRole("heading", { name: /^Country Details$/i })
    ).toBeVisible();

    await expect(
      page.getByText(
        "Country Code: Use a two-letter country code in uppercase, for example DE."
      )
    ).toBeVisible();

    await expect(
      page.getByText("The string should match pattern: ^[A-Z]{2}$")
    ).toHaveCount(0);
  });

  test("validates a residence-title date through the native browser control", async ({
    authenticatedPage: page,
  }) => {
    test.skip(
      isRemoteE2ETarget(),
      "Deterministic residence-title coverage relies on local route mocks."
    );

    await installWizardValidationRoutes(page.context(), {
      templates: [personalInformationTemplate],
      submissions: [personalInformationSubmission],
    });
    await page.clock.install({ time: new Date("2026-05-15T12:00:00Z") });

    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /^Personal Information$/i })
    ).toBeVisible();

    const identityUploadGroup = page.getByRole("radiogroup", {
      name: /would you like to upload your identity document now/i,
    });
    await identityUploadGroup
      .getByRole("radio", { name: /^(no|nein)$/i })
      .click();

    await page.getByLabel(/residence title type/i).click();
    await page
      .getByRole("option", { name: /temporary residence permit/i })
      .click();

    const expiryInput = page.getByLabel(/residence title valid until/i);
    await expect(expiryInput).toHaveAttribute("type", "date");
    await expiryInput.fill("2030-06-01");
    await expiryInput.press("Tab");

    await expect(expiryInput).toHaveValue("2030-06-01");
    await expect(
      page.getByText(/must remain valid after your contract start date/i)
    ).toHaveCount(0);

    await expect(
      page.getByRole("radiogroup", { name: /employment permitted/i })
    ).toBeVisible();
  });
});
