// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, test, type Locator } from "@playwright/test";
import { isRemoteE2ETarget } from "./auth-helpers";
import {
  buildOfflineLiveMockUser,
  installMockAuthRoutes,
  installMockOrganizationRoutes,
  installStoredMockBrowserSession,
} from "./offline-live-helpers";

test.use({ serviceWorkers: "block" });
test.skip(
  ({ baseURL }) => isRemoteE2ETarget(baseURL),
  "Uses deterministic local session and address fixtures."
);

test.beforeEach(async ({ page, context }) => {
  const user = buildOfflineLiveMockUser({
    permissions: ["employees.read", "employees.create"],
  });
  await context.route("**/runtime-config.js", (route) =>
    route.fulfill({
      contentType: "application/javascript",
      body: "window.__SECPAL_RUNTIME_CONFIG__ = {apiBaseUrl: null};",
    })
  );
  await context.route("**/v1/**", (route) =>
    route.fulfill({ json: { data: [] } })
  );
  await installMockAuthRoutes(context, user);
  await installMockOrganizationRoutes(context);
  await installStoredMockBrowserSession(page, user);

  await context.route("**/v1/addresses/de/localities?**", (route) => {
    const postalCode = new URL(route.request().url()).searchParams.get(
      "postal_code"
    );
    const localities =
      postalCode === "421"
        ? ["Wuppertal"]
        : [
            "Wuppertal",
            "Barmen",
            "Elberfeld",
            "Vohwinkel",
            "Cronenberg",
            "Ronsdorf",
            "Langerfeld",
            "Beyenburg",
          ];
    return route.fulfill({
      json: {
        data: localities.map((locality) => ({
          postal_code: postalCode === "421" ? "42103" : "42109",
          locality,
        })),
        meta: { source: "OpenPLZ API Data" },
      },
    });
  });

  await page.goto("/employees/create");
  await expect(page.locator("#address_postal_code")).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
});

async function positionPostalCode(postalCode: Locator, spaceBelow: number) {
  await postalCode.evaluate((input, spaceBelow) => {
    input.scrollIntoView({ block: "center", behavior: "instant" });
    let scroller = input.parentElement;
    while (
      scroller &&
      !(
        scroller.scrollHeight > scroller.clientHeight &&
        /auto|scroll/.test(getComputedStyle(scroller).overflowY)
      )
    ) {
      scroller = scroller.parentElement;
    }
    const offset =
      input.getBoundingClientRect().bottom - innerHeight + spaceBelow;
    (scroller ?? document.scrollingElement)?.scrollBy({
      top: offset,
      behavior: "instant",
    });
    input.focus({ preventScroll: true });
  }, spaceBelow);
}

test("keeps a growing address suggestion list anchored and scrollable", async ({
  page,
}) => {
  const postalCode = page.locator("#address_postal_code");
  await positionPostalCode(postalCode, 180);
  const list = page.getByRole("listbox");
  const popup = page.locator(
    "[data-slot=employee-autocomplete-popover-content]"
  );
  await postalCode.fill("421");
  await expect(list.getByRole("option")).toHaveCount(1);
  await expect(popup).toHaveAttribute("data-side", "bottom");

  await page.keyboard.type("09");
  await expect(list.getByRole("option")).toHaveCount(8);
  await expect
    .poll(() =>
      popup.evaluate((element) => ({
        side: (element as HTMLElement).dataset.side,
        withinViewport: element.getBoundingClientRect().bottom <= innerHeight,
        animation: getComputedStyle(element).animationName,
      }))
    )
    .toEqual({ side: "bottom", withinViewport: true, animation: "none" });
  await expect(postalCode).toBeFocused();
  // Mobile Chromium rounds the intersection at the popup's clipping boundary.
  await expect(page.getByRole("note")).toBeInViewport({ ratio: 0.999 });
  expect(
    await list.evaluate((node) => node.scrollHeight > node.clientHeight)
  ).toBe(true);

  await list.getByRole("option", { name: /Beyenburg/ }).click();
  await expect(page.locator("#address_city")).toHaveValue("Beyenburg");
});

test("keeps a suggestion selectable when the attribution exceeds the available height", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 164 });
  const postalCode = page.locator("#address_postal_code");
  await positionPostalCode(postalCode, 60);
  await postalCode.fill("421");

  const list = page.getByRole("listbox");
  await expect(list.getByRole("option")).toHaveCount(1);
  expect(
    await list.evaluate((element) => element.clientHeight)
  ).toBeGreaterThan(0);
  const attribution = page.getByRole("note");
  await attribution.scrollIntoViewIfNeeded();
  await expect(attribution).toBeInViewport();
  await list.getByRole("option", { name: /Wuppertal/ }).click();
  await expect(page.locator("#address_city")).toHaveValue("Wuppertal");
});
