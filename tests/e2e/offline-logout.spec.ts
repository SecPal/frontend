// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, test } from "@playwright/test";
import {
  installMockAuthRoutes,
  loginWithMockedBrowserSession,
  offlineLiveMockUser,
} from "./offline-live-helpers";

const supportsServiceWorkerOfflineFlows =
  Boolean(process.env.CI) ||
  (process.env.PLAYWRIGHT_BASE_URL?.startsWith("https://") ?? false);

const OFFLINE_SESSION_STATE_PATH = "/__session-state__";

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
    await loginWithMockedBrowserSession(page);

    await page.goto("/profile");
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /my profile/i })
    ).toBeVisible();
    await expect(
      page.getByText(offlineLiveMockUser.name).first()
    ).toBeVisible();
    await expect(
      page.getByText(offlineLiveMockUser.email).first()
    ).toBeVisible();

    await context.setOffline(true);
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(
      page.getByRole("heading", { name: /my profile/i })
    ).toBeVisible();
    await expect(
      page.getByText(offlineLiveMockUser.name).first()
    ).toBeVisible();
    await expect(
      page.getByText(offlineLiveMockUser.email).first()
    ).toBeVisible();

    await page.evaluate(() => {
      localStorage.setItem(
        "secpal-notification-preferences",
        JSON.stringify([{ category: "alerts", enabled: false }])
      );
    });

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

        if (
          "caches" in globalThis &&
          cacheNames.includes("auth-session-state")
        ) {
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
      page.getByText(offlineLiveMockUser.name).first()
    ).not.toBeVisible();
    await expect(
      page.getByText(offlineLiveMockUser.email).first()
    ).not.toBeVisible();

    await page.goto("/settings").catch(() => undefined);
    await page.waitForURL(/\/login/);

    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();

    await context.setOffline(false);
  });
});
