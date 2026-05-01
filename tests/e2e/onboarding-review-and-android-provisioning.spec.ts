// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./auth.setup";
import {
  buildOfflineLiveMockUser,
  installMockAuthRoutes,
  installStoredMockBrowserSession,
} from "./offline-live-helpers";

const androidProvisioningMockUser = buildOfflineLiveMockUser({
  permissions: ["android_enrollment.read", "android_enrollment.write"],
});

const onboardingReviewMockUser = buildOfflineLiveMockUser({
  permissions: ["employees.read", "employees.activate", "onboarding.confirm"],
});

const baseAndroidSession = {
  id: "session-1",
  device_label: "Front desk tablet",
  status: "pending",
  update_channel: "managed_device",
  bootstrap_token_expires_at: "2026-05-02T12:00:00Z",
  revoked_at: null,
  revocation_reason: null,
};

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

async function installAndroidProvisioningMockSession(page: Page) {
  await installMockAuthRoutes(page.context(), androidProvisioningMockUser);
  await installStoredMockBrowserSession(page, androidProvisioningMockUser);
}

async function installOnboardingReviewMockSession(page: Page) {
  await installMockAuthRoutes(page.context(), onboardingReviewMockUser);
  await installStoredMockBrowserSession(page, onboardingReviewMockUser);
}

async function installAndroidProvisioningRoutes(
  context: BrowserContext,
  requestLog: string[]
) {
  const sessions = [{ ...baseAndroidSession }];

  await context.route(
    "**/v1/android-enrollment-sessions?per_page=15",
    async (route) => {
      const url = new URL(route.request().url());
      requestLog.push(
        `${route.request().method()} ${url.pathname}${url.search}`
      );

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: sessions }),
      });
    }
  );

  await context.route("**/v1/android-enrollment-sessions", async (route) => {
    const url = new URL(route.request().url());
    requestLog.push(`${route.request().method()} ${url.pathname}${url.search}`);

    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }

    const payload = route.request().postDataJSON() as
      | { device_label?: string; update_channel?: string }
      | undefined;
    const createdSession = {
      id: "session-2",
      device_label: payload?.device_label ?? "Reception kiosk",
      status: "pending",
      update_channel: payload?.update_channel ?? "managed_device",
      bootstrap_token_expires_at: "2026-05-02T13:00:00Z",
      revoked_at: null,
      revocation_reason: null,
    };

    sessions.unshift(createdSession);

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          session: createdSession,
          provisioning_qr_payload: {
            "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME":
              "app.secpal/.SecPalDeviceAdminReceiver",
            "android.app.extra.PROVISIONING_ADMIN_EXTRAS_BUNDLE": {
              bootstrap_token: "tok-android-session-2",
              enrollment_session_id: createdSession.id,
            },
          },
        },
      }),
    });
  });

  await context.route(
    "**/v1/android-enrollment-sessions/*/revoke",
    async (route) => {
      const url = new URL(route.request().url());
      requestLog.push(
        `${route.request().method()} ${url.pathname}${url.search}`
      );

      const revokedSessionId = url.pathname.split("/").at(-2);
      const payload = route.request().postDataJSON() as { reason?: string };
      const targetSession = sessions.find(
        (session) => session.id === revokedSessionId
      );

      if (!targetSession) {
        await route.fulfill({
          status: 404,
          contentType: "application/json",
          body: JSON.stringify({ message: "Not found" }),
        });
        return;
      }

      targetSession.status = "revoked";
      targetSession.revoked_at = "2026-05-01T10:00:00Z";
      targetSession.revocation_reason = payload.reason ?? null;

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: targetSession }),
      });
    }
  );
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

test.describe("Neutral review and provisioning flows", () => {
  test("uses the neutral Android enrollment endpoints for load and create", async ({
    authenticatedPage: page,
  }) => {
    const requestLog: string[] = [];

    await installAndroidProvisioningMockSession(page);
    await installAndroidProvisioningRoutes(page.context(), requestLog);

    await page.goto("/android-provisioning");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /Android Provisioning/i })
    ).toBeVisible();
    await expect(page.getByText("Front desk tablet")).toBeVisible();
    expect(requestLog).toContain(
      "GET /v1/android-enrollment-sessions?per_page=15"
    );

    await page.getByLabel(/Device label/i).fill("Reception kiosk");
    await page.getByLabel(/Update channel/i).selectOption("direct_apk");
    await page
      .getByRole("button", { name: /Create enrollment session/i })
      .click();

    await expect(
      page.getByRole("heading", { name: /Provisioning QR code/i })
    ).toBeVisible();
    await expect(
      page.getByAltText(/Android provisioning QR code/i)
    ).toBeVisible();
    expect(requestLog).toContain("POST /v1/android-enrollment-sessions");
  });

  test("uses the neutral Android revoke endpoint", async ({
    authenticatedPage: page,
  }) => {
    const requestLog: string[] = [];

    await installAndroidProvisioningMockSession(page);
    await installAndroidProvisioningRoutes(page.context(), requestLog);

    await page.goto("/android-provisioning");
    await page.waitForLoadState("networkidle");

    page.once("dialog", async (dialog) => {
      expect(dialog.type()).toBe("prompt");
      await dialog.accept("Token exposed");
    });

    await page
      .getByRole("button", { name: /Revoke/i })
      .first()
      .click();

    await expect(
      page
        .locator("span")
        .filter({ hasText: /^Revoked$/ })
        .first()
    ).toBeVisible();
    await expect(page.getByText(/Token exposed/i)).toBeVisible();
    expect(requestLog).toContain(
      "POST /v1/android-enrollment-sessions/session-1/revoke"
    );
  });

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
