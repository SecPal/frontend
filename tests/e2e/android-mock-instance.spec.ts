// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import {
  expect,
  test,
  type BrowserContext,
  type Page,
  type Route,
} from "@playwright/test";

const SELECTED_ORIGIN = "https://other.secpal.dev";

function selectedCorsHeaders(route: Route): Record<string, string> {
  return {
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers":
      "Accept-Language, Content-Type, X-Requested-With, X-XSRF-TOKEN",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Origin":
      route.request().headers()["origin"] ?? "http://localhost:5173",
  };
}

const healthyResponse = {
  status: "ready",
  checks: {
    database: "ok",
    tenant_keys: "ok",
    kek_file: "ok",
  },
  timestamp: "2026-07-17T00:00:00.000Z",
};

const bootstrapResponse = {
  data: {
    client_platform: "android",
    api_base_url: `${SELECTED_ORIGIN}/v1`,
    instance: { display_name: "Other Tenant" },
    compatibility: {
      bootstrap_version: "v1",
      schema_version: 3,
      minimum_supported_app_version: "1.0.0",
      minimum_supported_app_build: 1,
    },
    features: {
      password_login: true,
      passkey_login: true,
      managed_android_enrollment: false,
      notification_channels: {
        android_fcm: false,
        web_push: false,
      },
    },
  },
};

test.describe("Android mock instance switching", () => {
  test.skip(
    process.env.PLAYWRIGHT_APP_SURFACE !== "android-mock",
    "These checks require the explicit Android mock surface."
  );

  async function installInitialRoutes(context: BrowserContext) {
    let logoutCalls = 0;

    await context.route("**/v1/me", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthenticated." }),
      });
    });
    await context.route("**/health/ready", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(healthyResponse),
      });
    });
    await context.route("**/sanctum/csrf-cookie", async (route) => {
      await route.fulfill({ status: 204 });
    });
    await context.route("**/v1/auth/logout", async (route) => {
      logoutCalls += 1;
      await route.fulfill({ status: 204 });
    });

    return { getLogoutCalls: () => logoutCalls };
  }

  async function openDiscovery(page: Page) {
    const switchButton = page.getByRole("button", { name: /switch instance/i });
    await expect(switchButton).toBeVisible();
    await switchButton.click();
    await page
      .getByRole("button", { name: /switch instance/i })
      .last()
      .click();
    await expect(
      page.getByRole("heading", { name: /enter your instance url/i })
    ).toBeVisible();
  }

  test("restores focus and keeps the instance section clear of the login card", async ({
    context,
    page,
  }) => {
    await installInitialRoutes(context);
    await page.setViewportSize({ width: 320, height: 673 });
    await page.goto("/login");

    const switchButton = page.getByRole("button", { name: /switch instance/i });
    await switchButton.click();
    await page.getByRole("button", { name: /cancel/i }).click();
    await expect(switchButton).toBeFocused();

    const cardBox = await page
      .getByRole("region", { name: /welcome to secpal/i })
      .boundingBox();
    const instanceBox = await page
      .getByTestId("runtime-instance-section")
      .boundingBox();

    expect(cardBox).not.toBeNull();
    expect(instanceBox).not.toBeNull();
    expect(instanceBox!.y).toBeGreaterThanOrEqual(cardBox!.y + cardBox!.height);
  });

  test("enters discovery and revokes the current browser session with an empty configured API base", async ({
    context,
    page,
  }) => {
    const routes = await installInitialRoutes(context);
    await page.goto("/login");

    await openDiscovery(page);

    await expect.poll(routes.getLogoutCalls).toBe(1);
  });

  test("retargets health and login requests to the selected instance", async ({
    context,
    page,
  }) => {
    await installInitialRoutes(context);
    const selectedHealthRequests: string[] = [];
    const selectedLoginRequests: string[] = [];

    await context.route(`${SELECTED_ORIGIN}/v1/bootstrap**`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(bootstrapResponse),
        headers: selectedCorsHeaders(route),
      });
    });
    await context.route(`${SELECTED_ORIGIN}/health/ready`, async (route) => {
      selectedHealthRequests.push(route.request().url());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(healthyResponse),
        headers: selectedCorsHeaders(route),
      });
    });
    await context.route(
      `${SELECTED_ORIGIN}/sanctum/csrf-cookie`,
      async (route) => {
        await route.fulfill({
          status: 204,
          headers: selectedCorsHeaders(route),
        });
      }
    );
    await context.route(`${SELECTED_ORIGIN}/v1/auth/login`, async (route) => {
      if (route.request().method() === "POST") {
        selectedLoginRequests.push(route.request().url());
      }

      await route.fulfill({
        status: route.request().method() === "OPTIONS" ? 204 : 401,
        contentType: "application/json",
        body:
          route.request().method() === "OPTIONS"
            ? undefined
            : JSON.stringify({ message: "Invalid credentials." }),
        headers: selectedCorsHeaders(route),
      });
    });

    await page.goto("/login");
    await openDiscovery(page);
    await page.getByLabel(/instance url/i).fill(SELECTED_ORIGIN);
    await page.getByRole("button", { name: /check instance/i }).click();
    await expect(
      page.getByRole("heading", { name: "Other Tenant" })
    ).toBeVisible();
    await page.getByRole("button", { name: /continue to login/i }).click();

    await expect(page.getByText(/signed in to other tenant/i)).toBeVisible();
    await expect.poll(() => selectedHealthRequests.length).toBeGreaterThan(0);

    await page.getByLabel(/email/i).fill("person@secpal.dev");
    await page.getByLabel(/password/i).fill("not-a-real-password");
    await page.getByRole("button", { name: /log in/i }).click();

    await expect.poll(() => selectedLoginRequests.length).toBe(1);
  });
});
