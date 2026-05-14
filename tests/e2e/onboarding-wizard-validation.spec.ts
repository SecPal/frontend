// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

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
const onboardingNationalities = [{ code: "DE", name: "German" }];

async function installWizardValidationRoutes(
  context: import("@playwright/test").BrowserContext
) {
  await context.route("**/v1/onboarding/templates", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [countryTemplate, finalTemplate],
      }),
    });
  });

  await context.route("**/v1/onboarding/templates/*", async (route) => {
    const templateId = route.request().url().split("/").at(-1);

    const template =
      templateId === countryTemplate.id
        ? countryTemplate
        : templateId === finalTemplate.id
          ? finalTemplate
          : null;

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
        data: [countrySubmission, finalSubmission],
      }),
    });
  });

  await context.route("**/v1/employees/*", async (route) => {
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
      | { status?: string }
      | undefined;
    const submissionId = route.request().url().split("/").at(-1);

    if (
      submissionId === countrySubmission.id &&
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
      submissionId === countrySubmission.id &&
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
      body: JSON.stringify({ data: finalSubmission }),
    });
  });
}

test.describe("Onboarding wizard validation fallback", () => {
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
});
