// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./auth.setup";
import {
  buildOfflineLiveMockUser,
  installMockAuthRoutes,
  installStoredMockBrowserSession,
} from "./offline-live-helpers";

const onboardingReviewMockUser = buildOfflineLiveMockUser({
  permissions: ["employees.read", "employees.activate", "onboarding.confirm"],
});

function buildEmployeeDetailResponse(overrides: Record<string, unknown> = {}) {
  return {
    id: "emp-onboarding",
    employee_number: "E404",
    first_name: "Jordan",
    last_name: "Reviewer",
    full_name: "Jordan Reviewer",
    email: "jordan.reviewer@secpal.dev",
    phone: "+49 151 00000042",
    date_of_birth: "1990-01-01",
    position: "Operations Lead",
    contract_start_date: "2026-05-10",
    bwr_id: null,
    bwr_status: "not_registered",
    bwr_registered_at: null,
    bwr_submission_date: null,
    bwr_notes: null,
    status: "pre_contract",
    contract_type: "full_time",
    management_level: 2,
    onboarding_completed: true,
    onboarding_workflow: {
      status: "submitted_for_review",
    },
    onboarding_invitation: {
      status: "sent",
      requested_at: "2026-05-01T09:00:00Z",
      token_created_at: "2026-05-01T09:00:00Z",
      mail_sent_at: "2026-05-01T09:01:00Z",
      mail_failed_at: null,
      failure_reason: null,
    },
    organizational_unit: {
      id: "org-root-1",
      name: "Operations",
    },
    created_at: "2026-05-01T00:00:00Z",
    updated_at: "2026-05-01T00:00:00Z",
    ...overrides,
  };
}

async function installOnboardingReviewMockSession(page: Page) {
  await installMockAuthRoutes(page.context(), onboardingReviewMockUser);
  await installStoredMockBrowserSession(page, onboardingReviewMockUser);
}

async function installOnboardingReviewRoutes(
  context: BrowserContext,
  requestLog: string[]
) {
  let employee = buildEmployeeDetailResponse();

  await context.route("**/v1/employees/emp-onboarding", async (route) => {
    const url = new URL(route.request().url());
    requestLog.push(`${route.request().method()} ${url.pathname}${url.search}`);

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: employee }),
    });
  });

  await context.route(
    "**/v1/onboarding-review/employees/emp-onboarding/confirm",
    async (route) => {
      const url = new URL(route.request().url());
      requestLog.push(
        `${route.request().method()} ${url.pathname}${url.search}`
      );

      employee = buildEmployeeDetailResponse({
        onboarding_workflow: {
          status: "ready_for_activation",
        },
      });

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: employee }),
      });
    }
  );
}

test.describe("Neutral onboarding review flows", () => {
  test("uses the neutral onboarding review confirm endpoint from employee detail", async ({
    authenticatedPage: page,
  }) => {
    const requestLog: string[] = [];

    await installOnboardingReviewMockSession(page);
    await installOnboardingReviewRoutes(page.context(), requestLog);

    await page.goto("/employees/emp-onboarding");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("button", { name: /Confirm Onboarding/i })
    ).toBeVisible();
    expect(requestLog).toContain("GET /v1/employees/emp-onboarding");

    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("confirm");
      await dialog.accept();
    });

    await page.getByRole("button", { name: /Confirm Onboarding/i }).click();

    await expect(page.getByRole("button", { name: /Activate/i })).toBeVisible();
    expect(requestLog).toContain(
      "POST /v1/onboarding-review/employees/emp-onboarding/confirm"
    );
  });
});
