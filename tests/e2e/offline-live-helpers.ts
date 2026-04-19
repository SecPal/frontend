// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, type BrowserContext, type Page } from "@playwright/test";
import { waitForLoginFormReady } from "./auth-helpers";

const MOCK_XSRF_TOKEN = "test-xsrf-token";

async function ensureMockXsrfCookie(context: BrowserContext): Promise<void> {
    await context.addCookies([
        {
            name: "XSRF-TOKEN",
            value: MOCK_XSRF_TOKEN,
            domain: "app.secpal.dev",
            path: "/",
            sameSite: "Lax",
            secure: true,
            httpOnly: false,
        },
    ]);
}

export const offlineLiveMockUser = {
    id: "42",
    name: "Jane Example",
    email: "jane.example@secpal.app",
    emailVerified: true,
    roles: ["Manager"],
    permissions: [],
    hasOrganizationalScopes: true,
    hasCustomerAccess: false,
    hasSiteAccess: false,
};

export const offlineLiveMockOrganizationUnit = {
    id: "org-root-1",
    type: "holding",
    name: "Headquarters Holding",
    custom_type_name: null,
    description: "Primary organizational root for offline live Playwright coverage.",
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

        await route.fulfill({
            status: 204,
            headers: {
                "set-cookie": `XSRF-TOKEN=${MOCK_XSRF_TOKEN}; Path=/; SameSite=Lax; Secure`,
            },
            body: "",
        });
    });

    await context.route("**/v1/auth/login", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ user: offlineLiveMockUser }),
        });
    });

    await context.route("**/v1/me", async (route) => {
        await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(offlineLiveMockUser),
        });
    });

    await context.route("**/v1/auth/logout", async (route) => {
        await route.fulfill({
            status: 204,
            body: "",
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
