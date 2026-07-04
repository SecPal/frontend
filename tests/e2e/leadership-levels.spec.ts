// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./auth.setup";
import {
  buildOfflineLiveMockUser,
  installMockAuthRoutes,
  installStoredMockBrowserSession,
} from "./offline-live-helpers";
import {
  isWorkspacePreviewTarget,
  resolvePlaywrightApiBaseUrl,
} from "./target-urls";

const playwrightEnv = globalThis as typeof globalThis & {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

// In the Polyscope workspace preview path (the only path that runs the live
// employee CRUD proof below), `resolvePlaywrightApiBaseUrl()` always returns
// the workspace's `api-<workspace>.preview.secpal.dev` origin, so the empty
// fallback is never reached at runtime; it only exists to keep the type as
// `string` instead of `string | undefined` for the `page.evaluate` payload.
const API_BASE_URL =
  resolvePlaywrightApiBaseUrl(playwrightEnv.process?.env ?? process.env) ?? "";
const LIVE_EMPLOYEE_CRUD_ENABLED =
  playwrightEnv.process?.env?.PLAYWRIGHT_LIVE_EMPLOYEE_CRUD === "1";

const mockUnit = {
  id: "org-root-1",
  type: "holding",
  name: "Headquarters Holding",
  custom_type_name: null,
  description: "Primary organizational unit for management-level E2E flows.",
  parent: null,
  created_at: "2026-04-20T00:00:00Z",
  updated_at: "2026-04-20T00:00:00Z",
};

const seededEmployees = [
  {
    id: "employee-1",
    full_name: "Casey Branch",
    first_name: "Casey",
    last_name: "Branch",
    employee_number: "EMP-1001",
    email: "casey.branch@secpal.dev",
    phone: "+49 151 00000001",
    position: "Branch Manager",
    status: "active",
    contract_type: "full_time",
    date_of_birth: "1990-01-01",
    contract_start_date: "2026-01-01",
    management_level: 3,
    organizational_unit_id: mockUnit.id,
    organizational_unit: {
      id: mockUnit.id,
      name: mockUnit.name,
    },
  },
  {
    id: "employee-2",
    full_name: "Jordan Guard",
    first_name: "Jordan",
    last_name: "Guard",
    employee_number: "EMP-1002",
    email: "jordan.guard@secpal.dev",
    phone: "+49 151 00000002",
    position: "Security Officer",
    status: "active",
    contract_type: "full_time",
    date_of_birth: "1994-02-02",
    contract_start_date: "2026-01-01",
    management_level: 0,
    organizational_unit_id: mockUnit.id,
    organizational_unit: {
      id: mockUnit.id,
      name: mockUnit.name,
    },
  },
];

const employeeManagementMockUser = buildOfflineLiveMockUser({
  permissions: ["employees.read", "employees.create", "employees.update"],
});

interface MockEmployeeRoutes {
  createdPayloads: Array<Record<string, unknown>>;
}

function buildCreatedEmployee(payload: Record<string, unknown>, index: number) {
  const firstName = String(payload.first_name ?? "Taylor");
  const lastName = String(payload.last_name ?? "Example");
  const managementLevel = Number(payload.management_level ?? 0);

  return {
    id: `employee-created-${index}`,
    full_name: `${firstName} ${lastName}`,
    first_name: firstName,
    last_name: lastName,
    employee_number: `EMP-20${index.toString().padStart(2, "0")}`,
    email: String(payload.email ?? `employee.${index}@secpal.dev`),
    phone: String(payload.phone ?? "+49 151 00000099"),
    position: String(payload.position ?? "Operations Lead"),
    status: String(payload.status ?? "pre_contract"),
    contract_type: String(payload.contract_type ?? "full_time"),
    date_of_birth: String(payload.date_of_birth ?? "1992-03-03"),
    contract_start_date: String(payload.contract_start_date ?? "2026-01-01"),
    management_level: managementLevel,
    organizational_unit_id: String(
      payload.organizational_unit_id ?? mockUnit.id
    ),
    organizational_unit: {
      id: String(payload.organizational_unit_id ?? mockUnit.id),
      name: mockUnit.name,
    },
  };
}

async function installMockEmployeeRoutes(
  context: BrowserContext
): Promise<MockEmployeeRoutes> {
  const createdPayloads: Array<Record<string, unknown>> = [];
  const employees = [...seededEmployees];

  await context.route("**/v1/organizational-units**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [mockUnit],
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 100,
          total: 1,
          root_unit_ids: [mockUnit.id],
        },
      }),
    });
  });

  await context.route(/\/v1\/employees(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === "GET" && url.pathname.endsWith("/v1/employees")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: employees,
          meta: {
            current_page: 1,
            last_page: 1,
            per_page: 15,
            total: employees.length,
          },
        }),
      });
      return;
    }

    if (request.method() === "POST" && url.pathname.endsWith("/v1/employees")) {
      const payload =
        (request.postDataJSON() as Record<string, unknown> | null) ?? {};
      createdPayloads.push(payload);

      const createdEmployee = buildCreatedEmployee(
        payload,
        createdPayloads.length
      );
      employees.unshift(createdEmployee);

      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ data: createdEmployee }),
      });
      return;
    }

    await route.continue();
  });

  await context.route("**/v1/employees/*", async (route) => {
    const request = route.request();
    const employeeId = new URL(request.url()).pathname.split("/").pop();
    const employee = employees.find((entry) => entry.id === employeeId);

    if (request.method() === "GET" && employee) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: employee }),
      });
      return;
    }

    await route.continue();
  });

  return { createdPayloads };
}

async function installEmployeeManagementMockSession(page: Page): Promise<void> {
  await installMockAuthRoutes(page.context(), employeeManagementMockUser);
  await installStoredMockBrowserSession(page, employeeManagementMockUser);
}

async function fillRequiredEmployeeFields(
  page: Page,
  email: string,
  organizationalUnitId = mockUnit.id
): Promise<void> {
  await page.getByLabel(/First Name/i).fill("Taylor");
  await page.getByLabel(/Last Name/i).fill("Example");
  await page.getByLabel(/^Email/i).fill(email);
  await page.getByLabel(/Date of Birth/i).fill("01/01/1990");
  await page.locator("#position").fill("Operations Lead");
  await page.getByLabel(/Contract Start Date/i).fill("01/01/2026");
  await page
    .getByLabel(/Organizational Unit/i)
    .selectOption(organizationalUnitId);
}

async function cleanupLiveEmployee(
  page: Page,
  employeeId: string | null
): Promise<void> {
  if (!employeeId) {
    return;
  }

  try {
    const result = await page.evaluate(
      async ({ apiBaseUrl, targetEmployeeId }) => {
        const xsrfCookie = document.cookie
          .split(";")
          .map((cookie) => cookie.trim())
          .find((cookie) => cookie.startsWith("XSRF-TOKEN="));

        const headers = new Headers({
          Accept: "application/json",
        });

        if (xsrfCookie) {
          headers.set(
            "X-XSRF-TOKEN",
            decodeURIComponent(xsrfCookie.substring("XSRF-TOKEN=".length))
          );
        }

        try {
          const response = await fetch(
            `${apiBaseUrl}/v1/employees/${targetEmployeeId}`,
            { method: "DELETE", credentials: "include", headers }
          );
          return { ok: response.ok, status: response.status };
        } catch (err) {
          return { ok: false, status: 0, error: String(err) };
        }
      },
      { apiBaseUrl: API_BASE_URL, targetEmployeeId: employeeId }
    );

    if (!result.ok) {
      console.warn(
        `Live employee cleanup failed for ${employeeId}: HTTP ${result.status}${
          "error" in result ? ` (${result.error})` : ""
        }`
      );
    }
  } catch (err) {
    console.warn(
      `Live employee cleanup could not run for ${employeeId}: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
  }
}

async function getFirstSelectableOrganizationalUnitId(
  page: Page
): Promise<string> {
  const organizationalUnitSelect = page.getByLabel(/Organizational Unit/i);
  await expect(organizationalUnitSelect).toBeEnabled();

  return organizationalUnitSelect.evaluate((selectElement) => {
    const select = selectElement as HTMLSelectElement;
    const firstSelectableOption = Array.from(select.options).find(
      (option) => option.value && !option.disabled
    );

    return firstSelectableOption?.value ?? "";
  });
}

async function createLiveEmployeeViaUi(
  page: Page,
  email: string,
  options?: {
    organizationalUnitId?: string;
    managementLevel?: number;
  }
): Promise<{
  employeeId: string | null;
  organizationalUnitId: string;
  requestPayload: Record<string, unknown>;
}> {
  const organizationalUnitId =
    options?.organizationalUnitId ??
    (await getFirstSelectableOrganizationalUnitId(page));

  expect(organizationalUnitId).not.toBe("");

  const createResponsePromise = page.waitForResponse(
    (response) =>
      /\/v1\/employees$/.test(response.url()) &&
      response.request().method() === "POST"
  );

  await fillRequiredEmployeeFields(page, email, organizationalUnitId);

  if ((options?.managementLevel ?? 0) > 0) {
    await page.getByRole("switch", { name: /Leadership Position/i }).click();
    await page.getByRole("spinbutton").fill(String(options?.managementLevel));
  }

  await page.getByRole("button", { name: /Create Employee/i }).click();

  const createResponse = await createResponsePromise;
  expect(createResponse.ok()).toBe(true);

  const requestPayload =
    (createResponse.request().postDataJSON() as Record<
      string,
      unknown
    > | null) ?? {};
  const createPayload = (await createResponse.json()) as {
    data?: { id?: string };
  };

  return {
    employeeId: createPayload.data?.id ?? null,
    organizationalUnitId,
    requestPayload,
  };
}

test.describe("Management level employee flows", () => {
  test("shows the current leadership controls in employee create form", async ({
    authenticatedPage: page,
  }) => {
    await installEmployeeManagementMockSession(page);
    await installMockEmployeeRoutes(page.context());

    await page.goto("/employees/create");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /Create New Employee/i })
    ).toBeVisible();

    const leadershipSwitch = page.getByRole("switch", {
      name: /Leadership Position/i,
    });
    const managementLevelInput = page.getByRole("spinbutton");

    await expect(leadershipSwitch).toBeVisible();
    await expect(managementLevelInput).toBeDisabled();
  });

  test("enables and clears management level when leadership is toggled", async ({
    authenticatedPage: page,
  }) => {
    await installEmployeeManagementMockSession(page);
    await installMockEmployeeRoutes(page.context());

    await page.goto("/employees/create");
    await page.waitForLoadState("networkidle");

    const leadershipSwitch = page.getByRole("switch", {
      name: /Leadership Position/i,
    });
    const managementLevelInput = page.getByRole("spinbutton");

    await leadershipSwitch.click();
    await expect(leadershipSwitch).toBeChecked();
    await expect(managementLevelInput).toBeEnabled();

    await managementLevelInput.fill("12");
    await expect(managementLevelInput).toHaveValue("12");

    await leadershipSwitch.click();
    await expect(leadershipSwitch).not.toBeChecked();
    await expect(managementLevelInput).toBeDisabled();
    await expect(managementLevelInput).toHaveValue("");
  });

  test("validates management level range against the current form rules", async ({
    authenticatedPage: page,
  }) => {
    await installEmployeeManagementMockSession(page);
    await installMockEmployeeRoutes(page.context());

    await page.goto("/employees/create");
    await page.waitForLoadState("networkidle");

    await fillRequiredEmployeeFields(page, `range.${Date.now()}@secpal.dev`);

    const leadershipSwitch = page.getByRole("switch", {
      name: /Leadership Position/i,
    });

    await leadershipSwitch.click();
    await page.getByRole("button", { name: /Create Employee/i }).click();

    await expect(
      page.getByText(
        /Management level is required when leadership position is enabled/i
      )
    ).toBeVisible();

    const managementLevelInput = page.getByRole("spinbutton");
    await managementLevelInput.fill("256");
    await page.getByRole("button", { name: /Create Employee/i }).click();

    await expect(
      page.getByText(/Management level must be between 1 and 255/i)
    ).toBeVisible();
  });

  test("submits the current management level payload and navigates to the created employee", async ({
    authenticatedPage: page,
  }) => {
    await installEmployeeManagementMockSession(page);
    const mockRoutes = await installMockEmployeeRoutes(page.context());

    await page.goto("/employees/create");
    await page.waitForLoadState("networkidle");

    await fillRequiredEmployeeFields(page, `created.${Date.now()}@secpal.dev`);
    await page.getByRole("switch", { name: /Leadership Position/i }).click();
    await page.getByRole("spinbutton").fill("7");

    await page.getByRole("button", { name: /Create Employee/i }).click();

    await expect.poll(() => mockRoutes.createdPayloads.length).toBe(1);
    await expect(page).toHaveURL(/\/employees\/employee-created-1$/);

    expect(mockRoutes.createdPayloads[0]).toMatchObject({
      first_name: "Taylor",
      last_name: "Example",
      management_level: 7,
      organizational_unit_id: mockUnit.id,
    });
  });

  test("displays management level badges in employee list rows", async ({
    authenticatedPage: page,
  }) => {
    await installEmployeeManagementMockSession(page);
    await installMockEmployeeRoutes(page.context());

    await page.goto("/employees");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /Employee Management/i })
    ).toBeVisible();
    await expect(page.getByText(/ML 3/)).toBeVisible();
    await expect(page.getByText(/Branch Manager/)).toBeVisible();
    await expect(page.getByText(/Security Officer/)).toBeVisible();
  });
});

test.describe("Live employee proof", () => {
  // Describe-level skip so the `authenticatedPage` fixture (which performs a
  // real UI login through `auth.setup.ts`) never spins up against a
  // non-workspace remote. A per-test `test.skip(...)` inside the body would
  // run AFTER the fixture, leaking login traffic to retired live targets
  // such as `app.secpal.dev`.
  test.skip(
    !isWorkspacePreviewTarget(),
    "Live employee proof only runs against Polyscope workspace previews (frontend-<workspace>.preview.secpal.dev). Pure live targets such as app.secpal.dev are intentionally not part of the Polyscope E2E surface."
  );

  test("creates a non-management employee on the Polyscope workspace preview", async ({
    authenticatedPage: page,
  }, testInfo) => {
    test.skip(
      !LIVE_EMPLOYEE_CRUD_ENABLED || testInfo.project.name !== "chromium",
      "Set PLAYWRIGHT_LIVE_EMPLOYEE_CRUD=1 to run the live employee CRUD proof against the current Polyscope workspace preview (frontend-<workspace>.preview.secpal.dev / api-<workspace>.preview.secpal.dev) on the chromium project. The workspace-preview gate is handled at describe level."
    );

    const timestamp = Date.now();
    const employeeEmail = `playwright.live.employee.${timestamp}@secpal.dev`;
    let createdEmployeeId: string | null = null;

    try {
      await page.goto("/employees/create");
      await page.waitForLoadState("networkidle");

      const { employeeId, requestPayload: createRequestPayload } =
        await createLiveEmployeeViaUi(page, employeeEmail);

      expect(createRequestPayload).not.toHaveProperty("management_level");

      createdEmployeeId = employeeId;
      expect(createdEmployeeId).not.toBeNull();

      await expect(page).toHaveURL(
        new RegExp(`/employees/${createdEmployeeId}$`)
      );
      await expect(page.getByText(employeeEmail)).toBeVisible();
      await expect(page.getByText(/No management position/i)).toBeVisible();
    } finally {
      await cleanupLiveEmployee(page, createdEmployeeId);
    }
  });

  test("creates a leadership employee on the Polyscope workspace preview", async ({
    authenticatedPage: page,
  }, testInfo) => {
    test.skip(
      !LIVE_EMPLOYEE_CRUD_ENABLED || testInfo.project.name !== "chromium",
      "Set PLAYWRIGHT_LIVE_EMPLOYEE_CRUD=1 to run the live employee CRUD proof against the current Polyscope workspace preview (frontend-<workspace>.preview.secpal.dev / api-<workspace>.preview.secpal.dev) on the chromium project. The workspace-preview gate is handled at describe level."
    );

    const timestamp = Date.now();
    const employeeEmail = `playwright.live.employee.leadership.${timestamp}@secpal.dev`;
    const managementLevel = 9;
    let createdEmployeeId: string | null = null;

    try {
      await page.goto("/employees/create");
      await page.waitForLoadState("networkidle");

      const { employeeId, requestPayload: createRequestPayload } =
        await createLiveEmployeeViaUi(page, employeeEmail, {
          managementLevel,
        });

      createdEmployeeId = employeeId;
      expect(createdEmployeeId).not.toBeNull();
      expect(createRequestPayload).toMatchObject({
        email: employeeEmail,
        management_level: managementLevel,
      });

      await expect(page).toHaveURL(
        new RegExp(`/employees/${createdEmployeeId}$`)
      );
      await expect(page.getByText(employeeEmail)).toBeVisible();
      await expect(
        page.getByText(new RegExp(`ML ${managementLevel}`))
      ).toBeVisible();
      await expect(page.getByText(/No management position/i)).toHaveCount(0);
    } finally {
      await cleanupLiveEmployee(page, createdEmployeeId);
    }
  });
});
