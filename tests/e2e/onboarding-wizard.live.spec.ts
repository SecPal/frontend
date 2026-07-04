// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/**
 * Live onboarding wizard checks against the current Polyscope workspace preview
 * (`frontend-<workspace>.preview.secpal.dev` + `api-<workspace>.preview.secpal.dev`).
 *
 * Does **not** mock onboarding APIs — traffic goes to the real workspace backend
 * (workflow-bound onboarding endpoints). Pure live targets such as
 * `app.secpal.dev` are intentionally **not** part of the Polyscope E2E
 * surface; every Polyscope workspace ships its own preview backend with a
 * deterministic seed contract and is the only target this spec runs against.
 *
 * ## Test user
 *
 * With `PLAYWRIGHT_LIVE_ONBOARDING=1`, Playwright defaults to the **seeded** pre-contract
 * user `onboarding@example.com` / `password` when `TEST_USER_EMAIL` / `TEST_USER_PASSWORD`
 * are unset. Seed the API with `contrib/secpal-api/OnboardingE2eUserSeeder.php` (see
 * `contrib/secpal-api/README.md`).
 *
 * Override `TEST_USER_*` if you use a different onboarding-capable account.
 *
 * Tests in this file run **serially** so the smoke test and the full wizard do not
 * race on the same login session and onboarding drafts.
 *
 * If the live API returns **422** for `onboarding_workflow_status`, the full-flow test
 * is **skipped** by default (clear message). Set `PLAYWRIGHT_ONBOARDING_WORKFLOW_STRICT=1`
 * to fail hard instead while you align the API seeder.
 *
 * Run (auto-detects the current Polyscope workspace from the working directory):
 *
 * ```bash
 * export PLAYWRIGHT_LIVE_ONBOARDING=1
 * npx playwright test tests/e2e/onboarding-wizard.live.spec.ts --project=chromium
 * ```
 *
 * Or: `npm run test:e2e:live:onboarding` (resolves the workspace-preview URL via
 * `resolvePlaywrightBaseUrl()`).
 */

import { expect, test } from "./auth.setup";
import { isWorkspacePreviewTarget } from "./target-urls";
import { completeLiveOnboardingWizard } from "./onboarding-wizard-live-helpers";

const LIVE_ONBOARDING = process.env.PLAYWRIGHT_LIVE_ONBOARDING === "1";

const ONBOARDING_USER_HINT =
  "Der eingeloggte Nutzer hat vermutlich kein aktives Mitarbeiter-Onboarding (z. B. falscher Account). " +
  "API mit OnboardingE2eUserSeeder seeden (onboarding@example.com) oder TEST_USER_EMAIL / TEST_USER_PASSWORD auf einen pre-contract-Nutzer mit aktivem Workflow setzen.";

function assertOnboardingListOk(
  response: import("@playwright/test").Response,
  label: string,
  responseBodySnippet: string
): void {
  if (response.ok()) {
    return;
  }
  const status = response.status();
  const hint =
    status === 403 || status === 404 ? `${ONBOARDING_USER_HINT} ` : "";
  throw new Error(
    `${hint}${label} failed (${status}): ${responseBodySnippet.slice(0, 500)}`
  );
}

function isOnboardingSubmissionsListRequest(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.pathname === "/v1/onboarding/submissions" ||
      parsed.pathname.endsWith("/v1/onboarding/submissions")
    );
  } catch {
    return false;
  }
}

function parseLaravelDataArray(
  body: string,
  label: string
): Record<string, unknown>[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body) as unknown;
  } catch {
    throw new Error(`${label}: response body is not JSON`);
  }
  if (typeof parsed !== "object" || parsed === null || !("data" in parsed)) {
    throw new Error(`${label}: expected an object with a "data" key`);
  }
  const { data } = parsed as { data: unknown };
  if (!Array.isArray(data)) {
    throw new Error(`${label}: "data" must be an array`);
  }
  return data as Record<string, unknown>[];
}

function isOnboardingTemplatesListRequest(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.pathname === "/v1/onboarding/templates" ||
      parsed.pathname.endsWith("/v1/onboarding/templates")
    );
  } catch {
    return false;
  }
}

test.describe("Live onboarding wizard (workspace API)", () => {
  test.describe.configure({ mode: "serial" });

  // Describe-level skip prevents `authenticatedPage` from logging in before the
  // workspace-preview/live-onboarding gate is evaluated.
  test.skip(
    !isWorkspacePreviewTarget() || !LIVE_ONBOARDING,
    "Requires PLAYWRIGHT_LIVE_ONBOARDING=1 and a Polyscope workspace preview target (frontend-<workspace>.preview.secpal.dev). Pure live targets such as app.secpal.dev are intentionally not part of the Polyscope E2E surface; see file header."
  );

  test("loads onboarding and receives templates and submissions from the live API", async ({
    authenticatedPage: page,
  }) => {
    await page.goto("/onboarding");
    await page.waitForLoadState("networkidle");

    const url = page.url();
    if (/\/onboarding\/submitted/i.test(url)) {
      await expect(
        page.getByRole("heading", {
          name: /You're all set|Onboarding abgeschlossen/i,
        })
      ).toBeVisible({ timeout: 15_000 });
      return;
    }

    const templatesPromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        isOnboardingTemplatesListRequest(response.url()),
      { timeout: 45_000 }
    );
    const submissionsPromise = page.waitForResponse(
      (response) =>
        response.request().method() === "GET" &&
        isOnboardingSubmissionsListRequest(response.url()),
      { timeout: 45_000 }
    );

    await page.reload({ waitUntil: "networkidle" });
    const [templatesResponse, submissionsResponse] = await Promise.all([
      templatesPromise,
      submissionsPromise,
    ]);

    const templatesBody = await templatesResponse.text().catch(() => "");
    const submissionsBody = await submissionsResponse.text().catch(() => "");
    assertOnboardingListOk(
      templatesResponse,
      "GET onboarding templates",
      templatesBody
    );
    assertOnboardingListOk(
      submissionsResponse,
      "GET onboarding submissions",
      submissionsBody
    );

    const templates = parseLaravelDataArray(
      templatesBody,
      "GET onboarding templates"
    );
    const submissions = parseLaravelDataArray(
      submissionsBody,
      "GET onboarding submissions"
    );

    for (const row of templates) {
      expect(row).toHaveProperty("id");
    }
    for (const row of submissions) {
      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("form_template_id");
    }

    await expect(
      page.getByRole("heading", {
        name: /Welcome to SecPal Onboarding|Willkommen zum SecPal Onboarding/i,
      })
    ).toBeVisible({ timeout: 30_000 });
  });

  test.describe("full flow", () => {
    test.describe.configure({ timeout: 900_000 });

    test("walks every wizard step, fills visible fields, and reaches the submitted screen", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/onboarding");
      await page.waitForLoadState("networkidle");

      if (/\/onboarding\/submitted/i.test(page.url())) {
        test.skip(
          true,
          "Onboarding user is already on the submitted screen; reset the E2E employee (e.g. migrate:fresh --seed) to run the full wizard again."
        );
      }

      try {
        await completeLiveOnboardingWizard(page);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const workflowRejected =
          /422/.test(message) &&
          /onboarding_workflow|workflow is not in an expected state/i.test(
            message
          );
        if (workflowRejected) {
          if (process.env.PLAYWRIGHT_ONBOARDING_WORKFLOW_STRICT === "1") {
            throw error;
          }
          test.skip(
            true,
            "Live API returned 422 for onboarding workflow state. Update and re-run the API seeder for onboarding@example.com so onboarding_workflow.status matches what your backend expects for draft/create submission (see contrib/secpal-api/README.md and EmployeeOnboardingWorkflowStatus in the frontend)."
          );
        }
        throw error;
      }

      await expect(page).toHaveURL(/\/onboarding\/submitted/i, {
        timeout: 30_000,
      });
      await expect(
        page.getByRole("heading", {
          name: /You're all set|Onboarding abgeschlossen/i,
        })
      ).toBeVisible({ timeout: 30_000 });
    });
  });
});
