// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { test, expect, loginViaUI } from "./auth.setup";
import {
  buildOfflineLiveMockUser,
  installMockAuthRoutes,
} from "./offline-live-helpers";

const MOBILE_VIEWPORT_WIDTHS = [320, 360, 390, 412, 430] as const;

test.describe("Activity Logs", () => {
  test("keeps the overview free of horizontal overflow across narrow mobile widths", async ({
    context,
    page,
  }) => {
    const user = buildOfflineLiveMockUser({
      email: "activity-logs-mobile@secpal.dev",
      permissions: ["activity_log.read"],
    });

    await installMockAuthRoutes(context, user);

    await context.route("**/v1/organizational-units**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "unit-1",
              type: "department",
              name: "Operations",
              description: "Operational command",
              parent: null,
              created_at: "2026-06-01T08:00:00Z",
              updated_at: "2026-06-01T08:00:00Z",
            },
          ],
          meta: {
            current_page: 1,
            last_page: 1,
            per_page: 100,
            total: 1,
            root_unit_ids: ["unit-1"],
          },
        }),
      });
    });

    await context.route("**/v1/activity-logs**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [
            {
              id: "log-1",
              tenant_id: "tenant-1",
              organizational_unit_id: "unit-1",
              log_name:
                "permission_mobile_overflow_regression_0123456789abcdefghijklmnopqrstuvwxyz",
              description:
                "PermissionChangeForMobileActivityOverviewOverflowRegressionCoverage0123456789abcdefghijklmnopqrstuvwxyz",
              subject_type: "App\\Models\\User",
              subject_id: "user-1",
              subject: { id: "user-1", name: "Test Subject" },
              causer_type: "App\\Models\\User",
              causer_id: "user-2",
              causer: {
                id: "user-2",
                name: "AlexandraSecpalOverflowCoverage0123456789abcdefghijklmnopqrstuvwxyz",
                email: "alexandra@secpal.dev",
              },
              properties: { ip: "192.168.1.1" },
              event_hash: "hash-1",
              previous_hash: null,
              merkle_root: null,
              merkle_batch_id: null,
              merkle_proof: null,
              opentimestamp_proof: null,
              opentimestamp_merkle_root: null,
              opentimestamp_proof_confirmed: false,
              ots_confirmed_at: null,
              is_orphaned_genesis: false,
              orphaned_reason: null,
              orphaned_at: null,
              created_at: "2026-06-22T14:35:00Z",
              updated_at: "2026-06-22T14:35:00Z",
              verification: {
                chain_valid: true,
                chain_link_valid: true,
                merkle_valid: null,
                ots_valid: null,
              },
              organizational_unit: {
                id: "unit-1",
                name: "Operations",
                unit_type: "department",
              },
            },
          ],
          meta: {
            current_page: 1,
            from: 1,
            last_page: 2,
            per_page: 50,
            to: 1,
            total: 51,
          },
          links: {
            first: "/v1/activity-logs?page=1",
            last: "/v1/activity-logs?page=2",
            prev: null,
            next: "/v1/activity-logs?page=2",
          },
        }),
      });
    });

    await loginViaUI(page, user.email, "password");

    for (const width of MOBILE_VIEWPORT_WIDTHS) {
      await page.setViewportSize({ width, height: 915 });
      await page.goto("/activity-logs");
      await page.waitForLoadState("networkidle");

      await expect(
        page.getByRole("heading", { name: /activity logs/i })
      ).toBeVisible();
      await expect(
        page.locator('[data-slot="activity-log-mobile-list"]')
      ).toBeVisible();
      await expect(
        page.locator('[data-slot="activity-log-table-container"]')
      ).toHaveCount(0);

      const layoutState = await page.evaluate(() => ({
        usesMobileLayout: !window.matchMedia("(min-width: 40rem)").matches,
        rootOverflow: document.documentElement.scrollWidth - window.innerWidth,
        bodyOverflow: document.body.scrollWidth - window.innerWidth,
      }));

      expect(
        layoutState.usesMobileLayout,
        `mobile layout branch at width ${width}`
      ).toBe(true);
      expect(
        layoutState.rootOverflow,
        `documentElement overflow at width ${width}`
      ).toBeLessThanOrEqual(1);
      expect(
        layoutState.bodyOverflow,
        `body overflow at width ${width}`
      ).toBeLessThanOrEqual(1);
    }
  });
});
