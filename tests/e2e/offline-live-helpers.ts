// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, type BrowserContext, type Page } from "@playwright/test";
import { installStoredAuthUser } from "../utils/passkeyAuthStorage";
import { isRemoteE2ETarget, waitForLoginFormReady } from "./auth-helpers";

const MOCK_XSRF_TOKEN = "test-xsrf-token";
const MOCK_SESSION_COOKIE_NAME = "secpal-playwright-session";

function getMockCookieDomain(): string {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
  if (isRemoteE2ETarget(baseUrl)) {
    return new URL(baseUrl).hostname;
  }
  return "localhost";
}

async function ensureMockXsrfCookie(context: BrowserContext): Promise<void> {
  const isHttps = isRemoteE2ETarget(process.env.PLAYWRIGHT_BASE_URL);
  await context.addCookies([
    {
      name: "XSRF-TOKEN",
      value: MOCK_XSRF_TOKEN,
      domain: getMockCookieDomain(),
      path: "/",
      sameSite: "Lax",
      secure: isHttps,
      httpOnly: false,
    },
  ]);
}

export const offlineLiveMockUser = {
  id: "42",
  name: "Jane Example",
  email: "test@example.com",
  emailVerified: true,
  roles: ["Manager"],
  permissions: [],
  hasOrganizationalScopes: true,
  hasCustomerAccess: true,
  hasSiteAccess: true,
};

async function ensureMockSessionCookie(
  context: BrowserContext,
  value = "authenticated"
): Promise<void> {
  const isHttps = isRemoteE2ETarget(process.env.PLAYWRIGHT_BASE_URL);

  await context.addCookies([
    {
      name: MOCK_SESSION_COOKIE_NAME,
      value,
      domain: getMockCookieDomain(),
      path: "/",
      sameSite: "Lax",
      secure: isHttps,
      httpOnly: true,
    },
  ]);
}

function requestHasMockSessionCookie(cookieHeader: string | null): boolean {
  if (!cookieHeader) {
    return false;
  }

  return cookieHeader
    .split(";")
    .some(
      (cookie) => cookie.trim() === `${MOCK_SESSION_COOKIE_NAME}=authenticated`
    );
}

export const offlineLiveMockOrganizationUnit = {
  id: "org-root-1",
  type: "holding",
  name: "Headquarters Holding",
  custom_type_name: null,
  description:
    "Primary organizational root for offline live Playwright coverage.",
  parent: null,
  created_at: "2026-04-19T00:00:00Z",
  updated_at: "2026-04-19T00:00:00Z",
};

export async function installMockAuthRoutes(
  context: BrowserContext
): Promise<void> {
  await ensureMockXsrfCookie(context);

  await context.route("**/health/ready", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        status: "ready",
        checks: {
          database: "ok",
          tenant_keys: "ok",
          kek_file: "ok",
        },
        timestamp: new Date().toISOString(),
      }),
    });
  });

  await context.route("**/sanctum/csrf-cookie", async (route) => {
    await ensureMockXsrfCookie(context);

    const isHttps = isRemoteE2ETarget(process.env.PLAYWRIGHT_BASE_URL);
    await route.fulfill({
      status: 204,
      headers: {
        "set-cookie": `XSRF-TOKEN=${MOCK_XSRF_TOKEN}; Path=/; SameSite=Lax${isHttps ? "; Secure" : ""}`,
      },
      body: "",
    });
  });

  await context.route("**/v1/auth/login", async (route) => {
    const requestBody = route.request().postDataJSON() as
      | { email?: string }
      | undefined;

    if (requestBody?.email?.startsWith("wrong-user@")) {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Invalid credentials.",
          errors: {
            email: ["Invalid credentials."],
          },
        }),
      });

      return;
    }

    await ensureMockSessionCookie(context);

    const isHttps = isRemoteE2ETarget(process.env.PLAYWRIGHT_BASE_URL);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      headers: {
        "set-cookie": `${MOCK_SESSION_COOKIE_NAME}=authenticated; Path=/; SameSite=Lax${isHttps ? "; Secure" : ""}; HttpOnly`,
      },
      body: JSON.stringify({ user: offlineLiveMockUser }),
    });
  });

  await context.route("**/v1/me", async (route) => {
    if (
      !requestHasMockSessionCookie(await route.request().headerValue("cookie"))
    ) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthenticated." }),
      });

      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(offlineLiveMockUser),
    });
  });

  await context.route("**/v1/auth/logout", async (route) => {
    const isHttps = isRemoteE2ETarget(process.env.PLAYWRIGHT_BASE_URL);
    await route.fulfill({
      status: 204,
      headers: {
        "set-cookie": `${MOCK_SESSION_COOKIE_NAME}=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax${isHttps ? "; Secure" : ""}; HttpOnly`,
      },
      body: "",
    });
  });

  await context.route("**/v1/customers**", async (route) => {
    if (
      !requestHasMockSessionCookie(await route.request().headerValue("cookie"))
    ) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "Unauthenticated." }),
      });

      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [],
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 15,
          total: 0,
        },
      }),
    });
  });
}

export async function installMockOrganizationRoutes(
  context: BrowserContext
): Promise<void> {
  await context.route("**/v1/organizational-units**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
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
}

export async function ensureActiveServiceWorker(page: Page): Promise<void> {
  await page.waitForLoadState("networkidle");

  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    await navigator.serviceWorker.ready;
  });

  const hasController = await page.evaluate(() => {
    return (
      "serviceWorker" in navigator &&
      navigator.serviceWorker.controller !== null
    );
  });

  if (!hasController) {
    await page.reload();
    await page.waitForLoadState("networkidle");
  }
}

export async function loginWithMockedBrowserSession(page: Page): Promise<void> {
  await page.goto("/login");
  await ensureActiveServiceWorker(page);

  await page.locator("#email").fill(offlineLiveMockUser.email);
  await page.locator("#password").fill("password");
  await waitForLoginFormReady(page);
  await page
    .getByRole("button", { name: /log in|anmelden|einloggen/i })
    .click();

  await expect(page).toHaveURL(/\/$/);
}

export async function installStoredMockBrowserSession(
  page: Page,
  user = offlineLiveMockUser
): Promise<void> {
  await ensureMockXsrfCookie(page.context());
  await ensureMockSessionCookie(page.context());
  await installStoredAuthUser(page, user, MOCK_XSRF_TOKEN);
}
