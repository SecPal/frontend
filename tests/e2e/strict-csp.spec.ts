// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { expect, test } from "@playwright/test";
import {
  buildOfflineLiveMockUser,
  installMockAuthRoutes,
  installMockOrganizationRoutes,
  installStoredMockBrowserSession,
  loginWithMockedBrowserSession,
} from "./offline-live-helpers";

test("runs the production PWA without CSP violations", async ({ page }) => {
  test.setTimeout(60_000);
  const violations: string[] = [];
  const pageErrors: string[] = [];
  const resourceFailures: string[] = [];
  const authenticatedUser = buildOfflineLiveMockUser({
    permissions: [
      "employee.create",
      "employee.read",
      "employees.create",
      "employees.read",
      "organization.*",
    ],
  });

  await installMockAuthRoutes(page.context(), authenticatedUser);
  await installMockOrganizationRoutes(page.context());
  const onboardingTemplate = {
    id: "csp-template",
    name: "CSP browser contract",
    title: "CSP browser contract",
    description: "Exercises the production onboarding progress component.",
    form_schema: {
      type: "object",
      properties: {
        preferred_name: {
          type: "string",
          title: "Preferred name",
        },
      },
    },
    is_required: true,
    is_system_template: true,
    sort_order: 1,
    can_be_deleted: false,
    can_be_edited: false,
  };
  await page
    .context()
    .route("**/v1/onboarding/templates/csp-template", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: onboardingTemplate }),
      })
    );
  await page.context().route("**/v1/onboarding/templates", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [onboardingTemplate] }),
    })
  );
  await page.context().route("**/v1/onboarding/submissions", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    })
  );
  await page.context().route("**/v1/onboarding/nationalities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ data: [] }),
    })
  );
  await page.context().route("**/v1/lookups/legal-entities", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ id: "legal-entity-1", name: "SecPal Test GmbH" }],
      }),
    })
  );
  await page
    .context()
    .route("**/v1/lookups/legal-entities/*/establishments", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [{ id: "establishment-1", name: "Berlin" }],
        }),
      })
    );
  await page.addInitScript(() => {
    window.addEventListener("securitypolicyviolation", (event) => {
      const current = ((
        window as typeof window & { __secpalCspViolations?: string[] }
      ).__secpalCspViolations ??= []);
      current.push(
        `${event.violatedDirective}: ${event.blockedURI || "inline"}`
      );
    });
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (
      ![
        "document",
        "script",
        "stylesheet",
        "font",
        "image",
        "serviceworker",
      ].includes(request.resourceType())
    ) {
      return;
    }

    const failure = request.failure();
    resourceFailures.push(
      `${request.resourceType()} ${request.url()}: ${failure?.errorText ?? "failed"}`
    );
  });

  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /welcome to secpal/i })
  ).toBeVisible();
  await expect(page.locator("link[rel=stylesheet]")).toHaveCount(1);

  const initialStyleElements = await page.locator("style").count();
  const initialScriptElements = await page.locator("script").count();

  await page.getByRole("combobox", { name: /select language/i }).click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: /legal/i }).click();
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("Escape");

  await expect(page.getByRole("form", { name: /login form/i })).toBeVisible();

  await loginWithMockedBrowserSession(page);
  await installStoredMockBrowserSession(page, authenticatedUser);
  await page.waitForLoadState("networkidle");
  await expect(
    page.getByRole("heading", { name: /welcome to secpal/i })
  ).toBeVisible();

  const sidebar = page.locator('[data-slot="sidebar"]').first();
  const sidebarTrigger = page
    .getByRole("button", { name: /toggle sidebar/i })
    .first();
  if ((await sidebar.getAttribute("data-state")) === "expanded") {
    await sidebarTrigger.click();
  }
  await expect(sidebar).toHaveAttribute("data-state", "collapsed");
  await sidebar.getByRole("link", { name: /^home$/i }).hover();
  await expect(page.getByRole("tooltip", { name: /^home$/i })).toBeVisible();
  await sidebarTrigger.click();
  await expect(sidebar).toHaveAttribute("data-state", "expanded");

  await page.evaluate(() => {
    window.history.pushState({}, "", "/organization");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(
    page.getByRole("heading", { name: /organization structure/i })
  ).toBeVisible();
  await page.getByRole("button", { name: /add root unit/i }).click();
  const organizationDialog = page.getByRole("dialog", {
    name: /create organizational unit/i,
  });
  await expect(organizationDialog).toBeVisible();
  const assignableCheckbox = organizationDialog.getByRole("checkbox", {
    name: /assignable for new assignments/i,
  });
  await assignableCheckbox.click();
  await expect(assignableCheckbox).not.toBeChecked();
  await organizationDialog
    .getByRole("textbox", { name: /^name/i })
    .fill("CSP Test Unit");
  await page.keyboard.press("Escape");
  await expect(organizationDialog).not.toBeVisible();

  await page.evaluate(() => {
    window.history.pushState({}, "", "/employees/create");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(
    page.getByRole("heading", { name: /create new employee/i })
  ).toBeVisible();
  const invitationSwitch = page.getByRole("switch", {
    name: /send onboarding invitation/i,
  });
  await expect(invitationSwitch).toBeChecked();
  await invitationSwitch.click();
  await expect(invitationSwitch).not.toBeChecked();

  await page.evaluate(() => {
    window.history.pushState({}, "", "/onboarding");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(
    page.getByRole("progressbar", { name: /onboarding progress/i })
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => {
    window.history.pushState({}, "", "/");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await expect(
    page.getByRole("heading", { name: /welcome to secpal/i })
  ).toBeVisible();
  await page
    .getByRole("button", { name: /toggle sidebar/i })
    .first()
    .click();
  const mobileNavigation = page.getByRole("dialog", { name: /navigation/i });
  await expect(mobileNavigation).toBeVisible();
  await mobileNavigation
    .getByRole("button", { name: /close navigation/i })
    .click();
  await expect(mobileNavigation).not.toBeVisible();

  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean(await navigator.serviceWorker.getRegistration())
      )
    )
    .toBe(true);

  expect(await page.locator("style").count()).toBe(initialStyleElements);
  expect(await page.locator("script").count()).toBe(initialScriptElements);
  expect(await page.locator("[onclick],[onload],[onerror]").count()).toBe(0);

  violations.push(
    ...(await page.evaluate(
      () =>
        (window as typeof window & { __secpalCspViolations?: string[] })
          .__secpalCspViolations ?? []
    ))
  );

  expect(violations).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(resourceFailures).toEqual([]);
});
