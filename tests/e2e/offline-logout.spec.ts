// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, test, type Page } from "@playwright/test";
import {
  AUTH_SIDEBAR_TRIGGER_SELECTOR,
  isRemoteE2ETarget,
} from "./auth-helpers";
import {
  installMockAuthRoutes,
  loginWithMockedBrowserSession,
  offlineLiveMockUser,
} from "./offline-live-helpers";

const supportsServiceWorkerOfflineFlows =
  Boolean(process.env.CI) || isRemoteE2ETarget();

const OFFLINE_SESSION_STATE_PATH = "/__session-state__";
const LOGOUT_STATE_TIMEOUT_MS = 15_000;
const LOGOUT_STATE_POLL_INTERVAL_MS = 100;
const USER_MENU_BUTTON_NAME = /user menu|benutzermenü/i;
const SETTINGS_MENU_ITEM_NAME = /settings|einstellungen/i;
const SIGN_OUT_MENU_ITEM_NAME = /sign out|abmelden|ausloggen/i;
const REQUIRED_LOGOUT_BARRIER_KEY = "auth_logout_barrier";
const OPTIONAL_PERSISTED_LOCAL_STORAGE_KEYS = [
  REQUIRED_LOGOUT_BARRIER_KEY,
  "secpal-locale",
] as const;
const REMOVED_LOGOUT_LOCAL_STORAGE_KEYS = [
  "auth_user",
  "auth_token",
  "secpal-notification-preferences",
] as const;

interface PersistedLogoutState {
  cacheNames: string[];
  indexedDbNames: string[] | null;
  localStorageKeys: string[];
  offlineSessionState: unknown;
  sessionStorageKeys: string[];
}

function isExecutionContextDestroyed(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.includes("Execution context was destroyed")
  );
}

async function readPersistedLogoutState(
  page: Page
): Promise<PersistedLogoutState> {
  return page.evaluate(async (offlineSessionStatePath) => {
    const cacheNames = "caches" in globalThis ? await caches.keys() : [];
    let offlineSessionState: unknown = null;

    if ("caches" in globalThis && cacheNames.includes("auth-session-state")) {
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
  }, OFFLINE_SESSION_STATE_PATH);
}

async function waitForPersistedLogoutState(
  page: Page,
  timeout = LOGOUT_STATE_TIMEOUT_MS
): Promise<PersistedLogoutState> {
  const deadline = Date.now() + timeout;
  let lastPersistedState: PersistedLogoutState | null = null;

  while (Date.now() < deadline) {
    try {
      const persistedState = await readPersistedLogoutState(page);
      lastPersistedState = persistedState;
      const hasOnlyExpectedLocalStorageKeys =
        persistedState.localStorageKeys.length >= 1 &&
        persistedState.localStorageKeys.every((key) =>
          OPTIONAL_PERSISTED_LOCAL_STORAGE_KEYS.includes(
            key as (typeof OPTIONAL_PERSISTED_LOCAL_STORAGE_KEYS)[number]
          )
        );

      if (
        hasOnlyExpectedLocalStorageKeys &&
        persistedState.localStorageKeys.includes(REQUIRED_LOGOUT_BARRIER_KEY) &&
        persistedState.sessionStorageKeys.length === 0 &&
        persistedState.cacheNames.includes("auth-session-state") &&
        JSON.stringify(persistedState.offlineSessionState) ===
          JSON.stringify({ isAuthenticated: false })
      ) {
        return persistedState;
      }
    } catch (error) {
      if (!isExecutionContextDestroyed(error)) {
        throw error;
      }
    }

    await page.waitForTimeout(LOGOUT_STATE_POLL_INTERVAL_MS);
  }

  throw new Error(
    `Timed out waiting for the final persisted logout state. Last observed state: ${JSON.stringify(lastPersistedState)}`
  );
}

async function openAuthenticatedUserMenu(page: Page): Promise<void> {
  const userMenuButton = page.getByRole("button", {
    name: USER_MENU_BUTTON_NAME,
  });

  if (!(await userMenuButton.isVisible())) {
    await page.locator(AUTH_SIDEBAR_TRIGGER_SELECTOR).first().click();
    await expect(
      page.getByRole("dialog", { name: /navigation|navigationsmenü/i })
    ).toBeVisible();
  }

  const navigationDialog = page.getByRole("dialog", {
    name: /navigation|navigationsmenü/i,
  });
  const mobileUserMenuButton = navigationDialog.getByRole("button", {
    name: USER_MENU_BUTTON_NAME,
  });
  const activeUserMenuButton =
    (await navigationDialog.isVisible()) &&
    (await mobileUserMenuButton.isVisible())
      ? mobileUserMenuButton
      : userMenuButton;

  await activeUserMenuButton.click();

  await expect
    .poll(
      async () => {
        if (
          await page
            .getByRole("menuitem", { name: SETTINGS_MENU_ITEM_NAME })
            .isVisible()
        ) {
          return "open";
        }

        if (
          await page
            .getByRole("menuitem", { name: SIGN_OUT_MENU_ITEM_NAME })
            .isVisible()
        ) {
          return "open";
        }

        if (await activeUserMenuButton.isVisible()) {
          await activeUserMenuButton.press("Enter");
        }

        return "pending";
      },
      { timeout: 10_000, intervals: [250, 500, 1_000] }
    )
    .toBe("open");
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
    await openAuthenticatedUserMenu(page);
    await page.getByRole("menuitem", { name: SIGN_OUT_MENU_ITEM_NAME }).click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator("#email")).toBeVisible();
    await expect(page.locator("#password")).toBeVisible();
    const persistedState = await waitForPersistedLogoutState(page);

    expect(persistedState.localStorageKeys).toContain(
      REQUIRED_LOGOUT_BARRIER_KEY
    );
    expect(persistedState.localStorageKeys).toEqual(
      expect.arrayContaining([REQUIRED_LOGOUT_BARRIER_KEY])
    );
    for (const key of REMOVED_LOGOUT_LOCAL_STORAGE_KEYS) {
      expect(persistedState.localStorageKeys).not.toContain(key);
    }
    expect(persistedState.sessionStorageKeys).toEqual([]);
    expect(persistedState.offlineSessionState).toEqual({
      isAuthenticated: false,
    });
    expect(persistedState.cacheNames).toContain("auth-session-state");

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
