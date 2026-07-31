// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { expect, test } from "@playwright/test";
import { installStrictCspAudit } from "./strict-csp-audit";

const API_ORIGIN = "https://api.container.example";

test("runs the immutable frontend artifact with startup runtime configuration", async ({
  page,
}) => {
  test.setTimeout(60_000);
  const apiRequests: string[] = [];
  const pageErrors: string[] = [];
  const resourceFailures: string[] = [];
  const strictCspAudit = await installStrictCspAudit(page);

  await page.addInitScript((apiOrigin) => {
    const auditedWindow = window as typeof window & {
      __SECPAL_RUNTIME_CONFIG_AT_FIRST_API__?: string | null;
    };
    const originalFetch = window.fetch.bind(window);

    window.fetch = (input, init) => {
      const requestUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.href
            : input.url;

      if (
        requestUrl.startsWith(apiOrigin) &&
        auditedWindow.__SECPAL_RUNTIME_CONFIG_AT_FIRST_API__ === undefined
      ) {
        auditedWindow.__SECPAL_RUNTIME_CONFIG_AT_FIRST_API__ =
          window.__SECPAL_RUNTIME_CONFIG__?.apiBaseUrl ?? null;
      }

      return originalFetch(input, init);
    };
  }, API_ORIGIN);

  await page.context().route(`${API_ORIGIN}/**`, async (route) => {
    const request = route.request();
    apiRequests.push(request.url());

    const headers = {
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "Content-Type, X-XSRF-TOKEN",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-origin": "http://127.0.0.1:4176",
    };

    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers });
      return;
    }

    if (new URL(request.url()).pathname === "/health/ready") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        headers,
        body: JSON.stringify({ status: "ready", checks: {} }),
      });
      return;
    }

    await route.fulfill({
      status: 401,
      contentType: "application/json",
      headers,
      body: JSON.stringify({ message: "Unauthenticated." }),
    });
  });

  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => {
    if (
      ["document", "script", "stylesheet", "font", "serviceworker"].includes(
        request.resourceType()
      )
    ) {
      resourceFailures.push(`${request.resourceType()} ${request.url()}`);
    }
  });

  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: /welcome to secpal/i })
  ).toBeVisible();
  await expect(page.locator('link[rel="stylesheet"]')).toHaveCount(1);

  const languageSelect = page.getByRole("combobox", {
    name: /select language|sprache auswählen/i,
  });
  await languageSelect.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.getByRole("option", { name: "Deutsch" }).click();
  await expect(languageSelect).toContainText("Deutsch");

  await expect
    .poll(() => apiRequests.some((url) => url.startsWith(API_ORIGIN)))
    .toBe(true);
  expect(apiRequests.every((url) => url.startsWith(`${API_ORIGIN}/`))).toBe(
    true
  );
  expect(
    apiRequests.some((url) =>
      /configured|localhost:8000|api\.secpal\.dev/u.test(url)
    )
  ).toBe(false);

  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __SECPAL_RUNTIME_CONFIG_AT_FIRST_API__?: string | null;
          }
        ).__SECPAL_RUNTIME_CONFIG_AT_FIRST_API__
    )
  ).toBe(API_ORIGIN);

  await expect
    .poll(() =>
      page.evaluate(async () =>
        Boolean(await navigator.serviceWorker.getRegistration())
      )
    )
    .toBe(true);

  const runtimeConfigCacheEntries = await page.evaluate(async () => {
    const cacheNames = await caches.keys();
    const requestUrls = (
      await Promise.all(
        cacheNames.map(async (cacheName) => {
          const cache = await caches.open(cacheName);
          return (await cache.keys()).map((request) => request.url);
        })
      )
    ).flat();

    return requestUrls.filter((url) =>
      new URL(url).pathname.endsWith("/runtime-config.js")
    );
  });

  expect(runtimeConfigCacheEntries).toEqual([]);
  await expect(page.locator("style")).toHaveCount(0);
  await expect(page.locator("script:not([src])")).toHaveCount(0);
  expect(strictCspAudit.executableElementMutations).toEqual([]);
  expect(strictCspAudit.violations).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(resourceFailures).toEqual([]);
});
