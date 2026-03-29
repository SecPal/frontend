// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const supportsServiceWorkerOfflineFlows =
  Boolean(process.env.CI) ||
  (process.env.PLAYWRIGHT_BASE_URL?.startsWith("https://") ?? false);

const offlineLogoutMockUser = {
  id: 42,
  name: "Jane Example",
  email: "jane.example@secpal.app",
  roles: ["Employee"],
  permissions: [],
  hasOrganizationalScopes: false,
  hasCustomerAccess: false,
  hasSiteAccess: false,
};

const OFFLINE_SESSION_STATE_PATH = "/__session-state__";

async function installMockAuthRoutes(context: BrowserContext): Promise<void> {
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
    await route.fulfill({
      status: 204,
      headers: {
        "set-cookie": "XSRF-TOKEN=test-xsrf-token; Path=/; SameSite=Lax",
      },
      body: "",
    });
  });

  await context.route("**/v1/auth/login", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ user: offlineLogoutMockUser }),
    });
  });

  await context.route("**/v1/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(offlineLogoutMockUser),
    });
  });

  await context.route("**/v1/auth/logout", async (route) => {
    await route.fulfill({
      status: 204,
      body: "",
    });
  });
}

async function ensureActiveServiceWorker(page: Page): Promise<void> {
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

test.describe("Offline Logout Privacy", () => {
  test("should block offline access to the cached profile page after logout", async ({
    page,
    context,
  }) => {
    test.skip(
      !supportsServiceWorkerOfflineFlows,
      "Requires preview/staging mode with an active service worker."
    );

    await installMockAuthRoutes(context);

    await page.goto("/login");
    await ensureActiveServiceWorker(page);

    await page.locator("#email").fill(offlineLogoutMockUser.email);
    await page.locator("#password").fill("password");
    await page
      .getByRole("button", { name: /log in|anmelden|einloggen/i })
      .click();

    await expect(page).toHaveURL(/\/$/);

    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /my profile/i })
    ).toBeVisible();
    await expect(
      page.getByText(offlineLogoutMockUser.name).first()
    ).toBeVisible();
    await expect(
      page.getByText(offlineLogoutMockUser.email).first()
    ).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /my profile/i })
    ).toBeVisible();
    await expect(
      page.getByText(offlineLogoutMockUser.name).first()
    ).toBeVisible();
    await expect(
      page.getByText(offlineLogoutMockUser.email).first()
    ).toBeVisible();

    await context.setOffline(false);
    await page.getByRole("button", { name: /user menu/i }).click();
    await page.getByRole("menuitem", { name: /sign out|abmelden/i }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    expect(
      await page.evaluate(() => {
        return localStorage.getItem("auth_user");
      })
    ).toBeNull();

    const persistedState = await page.evaluate(
      async (offlineSessionStatePath) => {
        const cacheNames = "caches" in globalThis ? await caches.keys() : [];
        let offlineSessionState: unknown = null;

        if ("caches" in globalThis) {
          const cache = await caches.open("auth-session-state");
          const response = await cache.match(
            new URL(offlineSessionStatePath, window.location.origin).toString()
          );

          offlineSessionState = response ? await response.json() : null;
        }

        const indexedDbNames =
          typeof indexedDB.databases === "function"
            ? (await indexedDB.databases()).map((database) => database.name)
            : null;

        return {
          cacheNames,
          indexedDbNames,
          localStorageKeys: Object.keys(localStorage).sort(),
          offlineSessionState,
          sessionStorageKeys: Object.keys(sessionStorage).sort(),
        };
      },
      OFFLINE_SESSION_STATE_PATH
    );

    expect(persistedState.localStorageKeys).toEqual(["auth_logout_barrier"]);
    expect(persistedState.sessionStorageKeys).toEqual([]);
    expect(persistedState.offlineSessionState).toEqual({
      isAuthenticated: false,
    });
    expect(persistedState.cacheNames).toContain("auth-session-state");

    if (persistedState.indexedDbNames !== null) {
      expect(persistedState.indexedDbNames).not.toContain("SecPalDB");
    }

    await context.setOffline(true);
    await page.goto("/profile").catch(() => undefined);
    await page.waitForLoadState("networkidle");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    await expect(
      page.getByText(offlineLogoutMockUser.name).first()
    ).not.toBeVisible();
    await expect(
      page.getByText(offlineLogoutMockUser.email).first()
    ).not.toBeVisible();

    await page.goto("/settings").catch(() => undefined);
    await page.waitForURL(/\/login/);

    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();

    await context.setOffline(false);
  });
});
