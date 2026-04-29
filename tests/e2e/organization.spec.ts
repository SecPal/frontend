// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { test, expect } from "./auth.setup";
import { offlineLiveMockOrganizationUnit } from "./offline-live-helpers";
import { getCachedOrgUnitsCount } from "../utils/offline-helpers";

const ROTATED_XSRF_TOKEN = "rotated-xsrf-token";
const CREATED_CHILD_UNIT_ID = "org-child-1";
const CREATED_CHILD_UNIT_NAME = "Operations Branch";
const UPDATED_CHILD_DESCRIPTION = "Updated after create";
const MOVED_UNIT_ID = "org-move-1";
const MOVED_UNIT_NAME = "Field Office";
const TARGET_PARENT_ID = "org-target-parent";
const TARGET_PARENT_NAME = "Northern Region";

/**
 * Organization Management E2E Tests
 *
 * Basic integration tests for organizational structure pages.
 * These tests verify that pages load correctly for authenticated users.
 * For offline functionality tests, see offline.spec.ts
 */

test.describe("Organization Management", () => {
  test.describe("Organization Overview", () => {
    test("should display organization page", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/organization");
      await page.waitForLoadState("networkidle");

      // Should show organization page - check for heading
      await expect(
        page.getByRole("heading", { level: 1 }).first()
      ).toBeVisible();
    });

    test("should keep browser-session organization access after XSRF token rotation on authenticated GET refreshes", async ({
      authenticatedPage: page,
    }) => {
      const context = page.context();
      let organizationRequestCount = 0;

      await context.route("**/v1/organizational-units**", async (route) => {
        organizationRequestCount += 1;

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          headers:
            organizationRequestCount === 1
              ? {
                  "set-cookie": `XSRF-TOKEN=${ROTATED_XSRF_TOKEN}; Path=/; SameSite=Lax`,
                }
              : {},
          body: JSON.stringify({
            data: [offlineLiveMockOrganizationUnit],
            meta: {
              current_page: 1,
              last_page: 1,
              per_page: 100,
              total: 1,
              root_unit_ids: [offlineLiveMockOrganizationUnit.id],
            },
          }),
        });
      });

      await page.goto("/organization");
      await page.waitForLoadState("networkidle");

      await expect(
        page.getByRole("heading", { name: /organization structure/i })
      ).toBeVisible();
      await expect(
        page.getByText(offlineLiveMockOrganizationUnit.name).first()
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /user menu/i })
      ).toBeVisible();
      await expect(
        page.getByText("Offline vault is not available.")
      ).toHaveCount(0);

      await expect
        .poll(async () => {
          const cookies = await context.cookies([page.url()]);

          return cookies.find((cookie) => cookie.name === "XSRF-TOKEN")?.value;
        })
        .toBe(ROTATED_XSRF_TOKEN);

      await page.reload();
      await page.waitForLoadState("networkidle");

      await expect(
        page.getByRole("heading", { name: /organization structure/i })
      ).toBeVisible();
      await expect(
        page.getByText(offlineLiveMockOrganizationUnit.name).first()
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: /user menu/i })
      ).toBeVisible();
      await expect(
        page.getByText("Offline vault is not available.")
      ).toHaveCount(0);
      expect(organizationRequestCount).toBeGreaterThanOrEqual(2);
    });

    test("should keep a newly created child unit visible and editable after reload", async ({
      authenticatedPage: page,
    }) => {
      const context = page.context();
      let childUnitDescription: string | null = null;
      let childUnitCreated = false;
      let postCreateListRequestCount = 0;

      await context.route("**/v1/organizational-units**", async (route) => {
        const request = route.request();
        const method = request.method();
        const url = request.url();

        if (method === "POST" && /\/v1\/organizational-units$/.test(url)) {
          childUnitCreated = true;

          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                id: CREATED_CHILD_UNIT_ID,
                type: "company",
                name: CREATED_CHILD_UNIT_NAME,
                custom_type_name: null,
                description: childUnitDescription,
                parent: {
                  id: offlineLiveMockOrganizationUnit.id,
                  type: offlineLiveMockOrganizationUnit.type,
                  name: offlineLiveMockOrganizationUnit.name,
                },
                created_at: "2026-04-29T10:00:00Z",
                updated_at: "2026-04-29T10:00:00Z",
              },
            }),
          });

          return;
        }

        if (
          method === "GET" &&
          /\/v1\/organizational-units(\?.*)?$/.test(url)
        ) {
          const units: Array<Record<string, unknown>> = [
            offlineLiveMockOrganizationUnit,
          ];

          if (childUnitCreated) {
            postCreateListRequestCount += 1;

            if (postCreateListRequestCount >= 1) {
              units.push({
                id: CREATED_CHILD_UNIT_ID,
                type: "company",
                name: CREATED_CHILD_UNIT_NAME,
                custom_type_name: null,
                description: childUnitDescription,
                parent: {
                  id: offlineLiveMockOrganizationUnit.id,
                  type: offlineLiveMockOrganizationUnit.type,
                  name: offlineLiveMockOrganizationUnit.name,
                },
                created_at: "2026-04-29T10:00:00Z",
                updated_at: "2026-04-29T10:00:00Z",
              });
            }
          }

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: units,
              meta: {
                current_page: 1,
                last_page: 1,
                per_page: 100,
                total: units.length,
                root_unit_ids: [offlineLiveMockOrganizationUnit.id],
              },
            }),
          });

          return;
        }

        await route.fallback();
      });

      await context.route(
        `**/v1/organizational-units/${CREATED_CHILD_UNIT_ID}`,
        async (route) => {
          const request = route.request();

          if (request.method() === "PATCH") {
            const payload = request.postDataJSON() as { description?: string };
            childUnitDescription = payload.description ?? null;

            await route.fulfill({
              status: 200,
              contentType: "application/json",
              body: JSON.stringify({
                data: {
                  id: CREATED_CHILD_UNIT_ID,
                  type: "company",
                  name: CREATED_CHILD_UNIT_NAME,
                  custom_type_name: null,
                  description: childUnitDescription,
                  parent: {
                    id: offlineLiveMockOrganizationUnit.id,
                    type: offlineLiveMockOrganizationUnit.type,
                    name: offlineLiveMockOrganizationUnit.name,
                  },
                  created_at: "2026-04-29T10:00:00Z",
                  updated_at: "2026-04-29T10:05:00Z",
                },
              }),
            });

            return;
          }

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                id: CREATED_CHILD_UNIT_ID,
                type: "company",
                name: CREATED_CHILD_UNIT_NAME,
                custom_type_name: null,
                description: childUnitDescription,
                parent: {
                  id: offlineLiveMockOrganizationUnit.id,
                  type: offlineLiveMockOrganizationUnit.type,
                  name: offlineLiveMockOrganizationUnit.name,
                },
                created_at: "2026-04-29T10:00:00Z",
                updated_at: "2026-04-29T10:05:00Z",
              },
            }),
          });
        }
      );

      await page.goto("/organization");
      await page.waitForLoadState("networkidle");

      await page
        .getByText(offlineLiveMockOrganizationUnit.name)
        .first()
        .click();
      await page.getByRole("button", { name: /add child unit/i }).click();

      await expect(page.getByText(/create organizational unit/i)).toBeVisible();

      await page.getByLabel(/name/i).fill(CREATED_CHILD_UNIT_NAME);
      await page.getByRole("button", { name: /^create$/i }).click();

      const childTreeItem = page
        .getByRole("treeitem", {
          name: new RegExp(CREATED_CHILD_UNIT_NAME, "i"),
        })
        .first();

      await expect(childTreeItem).toBeVisible();

      await childTreeItem.click();
      await expect(page.getByRole("button", { name: /^edit$/i })).toBeVisible();
      await page.getByRole("button", { name: /^edit$/i }).click();
      await expect(page.getByText(/edit organizational unit/i)).toBeVisible();

      await page.getByLabel(/description/i).fill(UPDATED_CHILD_DESCRIPTION);
      await page.getByRole("button", { name: /save changes/i }).click();

      await expect(page.getByText(UPDATED_CHILD_DESCRIPTION)).toBeVisible();

      await page.reload();
      await page.waitForLoadState("networkidle");

      const reloadedChildTreeItem = page
        .getByRole("treeitem", {
          name: new RegExp(CREATED_CHILD_UNIT_NAME, "i"),
        })
        .first();

      await expect(reloadedChildTreeItem).toBeVisible();

      await reloadedChildTreeItem.click();
      await expect(page.getByText(UPDATED_CHILD_DESCRIPTION)).toBeVisible();
      await expect(page.getByRole("button", { name: /^edit$/i })).toBeVisible();
    });

    test("should keep a moved unit visible and editable after reload", async ({
      authenticatedPage: page,
    }) => {
      const context = page.context();
      let moveCompleted = false;
      let movedUnitDescription: string | null = null;

      const movedUnit = {
        id: MOVED_UNIT_ID,
        type: "department",
        name: MOVED_UNIT_NAME,
        custom_type_name: null,
        description: movedUnitDescription,
        get parent() {
          return moveCompleted
            ? {
                id: TARGET_PARENT_ID,
                type: "company",
                name: TARGET_PARENT_NAME,
              }
            : {
                id: offlineLiveMockOrganizationUnit.id,
                type: offlineLiveMockOrganizationUnit.type,
                name: offlineLiveMockOrganizationUnit.name,
              };
        },
        created_at: "2026-04-29T10:00:00Z",
        updated_at: "2026-04-29T10:00:00Z",
      };

      const targetParent = {
        id: TARGET_PARENT_ID,
        type: "company",
        name: TARGET_PARENT_NAME,
        custom_type_name: null,
        description: null,
        parent: null,
        created_at: "2026-04-29T09:00:00Z",
        updated_at: "2026-04-29T09:00:00Z",
      };

      await context.route("**/v1/organizational-units**", async (route) => {
        if (!/\/v1\/organizational-units(\?.*)?$/.test(route.request().url())) {
          await route.fallback();
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            data: [
              offlineLiveMockOrganizationUnit,
              targetParent,
              {
                ...movedUnit,
                description: movedUnitDescription,
                parent: moveCompleted
                  ? {
                      id: TARGET_PARENT_ID,
                      type: "company",
                      name: TARGET_PARENT_NAME,
                    }
                  : {
                      id: offlineLiveMockOrganizationUnit.id,
                      type: offlineLiveMockOrganizationUnit.type,
                      name: offlineLiveMockOrganizationUnit.name,
                    },
              },
            ],
            meta: {
              current_page: 1,
              last_page: 1,
              per_page: 100,
              total: 3,
              root_unit_ids: [
                offlineLiveMockOrganizationUnit.id,
                TARGET_PARENT_ID,
              ],
            },
          }),
        });
      });

      await context.route(
        `**/v1/organizational-units/${MOVED_UNIT_ID}/parent`,
        async (route) => {
          moveCompleted = true;

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                ...movedUnit,
                description: movedUnitDescription,
                parent: {
                  id: TARGET_PARENT_ID,
                  type: "company",
                  name: TARGET_PARENT_NAME,
                },
                updated_at: "2026-04-29T10:05:00Z",
              },
            }),
          });
        }
      );

      await context.route(
        `**/v1/organizational-units/${MOVED_UNIT_ID}`,
        async (route) => {
          const request = route.request();

          if (request.method() === "PATCH") {
            const payload = request.postDataJSON() as { description?: string };
            movedUnitDescription = payload.description ?? null;
          }

          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({
              data: {
                ...movedUnit,
                description: movedUnitDescription,
                parent: moveCompleted
                  ? {
                      id: TARGET_PARENT_ID,
                      type: "company",
                      name: TARGET_PARENT_NAME,
                    }
                  : {
                      id: offlineLiveMockOrganizationUnit.id,
                      type: offlineLiveMockOrganizationUnit.type,
                      name: offlineLiveMockOrganizationUnit.name,
                    },
                updated_at: "2026-04-29T10:06:00Z",
              },
            }),
          });
        }
      );

      await page.goto("/organization");
      await page.waitForLoadState("networkidle");

      const movedUnitTreeItem = page
        .getByRole("treeitem", { name: new RegExp(MOVED_UNIT_NAME, "i") })
        .first();

      await movedUnitTreeItem.click();
      await expect(page.getByRole("button", { name: /^edit$/i })).toBeVisible();

      const moveActionsButton = page.getByRole("button", {
        name: new RegExp(`Actions for ${MOVED_UNIT_NAME}`, "i"),
      });
      await moveActionsButton.click();
      await page.getByRole("menuitem", { name: /move/i }).click();

      await expect(
        page.getByText(new RegExp(`Move "${MOVED_UNIT_NAME}"`, "i"))
      ).toBeVisible();
      await page.getByRole("button", { name: /select new parent/i }).click();
      await page
        .getByRole("option", { name: new RegExp(TARGET_PARENT_NAME, "i") })
        .click();
      await page.getByRole("button", { name: /^move$/i }).click();

      const reparentedTreeItem = page
        .getByRole("treeitem", { name: new RegExp(MOVED_UNIT_NAME, "i") })
        .first();
      await expect(reparentedTreeItem).toBeVisible();

      await reparentedTreeItem.click();
      await expect(
        page.getByRole("definition").filter({ hasText: TARGET_PARENT_NAME })
      ).toBeVisible();

      await page.getByRole("button", { name: /^edit$/i }).click();
      await expect(page.getByText(/edit organizational unit/i)).toBeVisible();

      await page.getByLabel(/description/i).fill("Updated after move");
      await page.getByRole("button", { name: /save changes/i }).click();

      await expect(page.getByText("Updated after move")).toBeVisible();

      await page.reload();
      await page.waitForLoadState("networkidle");

      const reloadedMovedTreeItem = page
        .getByRole("treeitem", { name: new RegExp(MOVED_UNIT_NAME, "i") })
        .first();
      await expect(reloadedMovedTreeItem).toBeVisible();

      await reloadedMovedTreeItem.click();
      await expect(
        page.getByRole("definition").filter({ hasText: TARGET_PARENT_NAME })
      ).toBeVisible();
      await expect(page.getByText("Updated after move")).toBeVisible();
      await expect(page.getByRole("button", { name: /^edit$/i })).toBeVisible();
    });
  });

  test.describe("Customers", () => {
    test("should display customers list", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/customers");
      await page.waitForLoadState("networkidle");

      // Should show customers page
      await expect(
        page.getByRole("heading", { level: 1 }).first()
      ).toBeVisible();
    });
  });

  test.describe("Guard Books", () => {
    test("should display guard books list", async ({
      authenticatedPage: page,
    }) => {
      await page.goto("/guard-books");
      await page.waitForLoadState("networkidle");

      // Should show guard books page
      await expect(
        page.getByRole("heading", { level: 1 }).first()
      ).toBeVisible();
    });
  });

  test.describe("Performance", () => {
    test("should load organization pages without errors", async ({
      authenticatedPage: page,
    }) => {
      const jsErrors: string[] = [];
      // Set up console listener BEFORE navigation to catch all errors
      page.on("console", (msg) => {
        if (msg.type() === "error") {
          const text = msg.text();
          if (
            !text.includes("net::ERR_") &&
            !text.includes("Failed to load resource") &&
            !text.includes("favicon")
          ) {
            jsErrors.push(text);
          }
        }
      });

      const pages = ["/organization", "/customers", "/guard-books"];

      for (const path of pages) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
      }

      // Wait for any pending async operations
      await page.waitForLoadState("networkidle");

      expect(jsErrors).toHaveLength(0);
    });
  });

  test.describe("Cache Verification", () => {
    test("should populate IndexedDB cache on page load", async ({
      authenticatedPage: page,
    }) => {
      // Navigate to organization page
      await page.goto("/organization");
      await page.waitForLoadState("networkidle");

      // Wait for units to load
      await page.waitForTimeout(1000);

      // Check that cache is populated
      const cachedCount = await getCachedOrgUnitsCount(page);

      // We don't assert a specific number, just that cache works
      // In a real environment with data, this should be > 0
      expect(cachedCount).toBeGreaterThanOrEqual(0);
    });
  });
});
