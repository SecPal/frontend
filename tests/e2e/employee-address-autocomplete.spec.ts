// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, test } from "@playwright/test";
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

test("keeps a growing address suggestion list anchored and scrollable", async ({
  page,
  context,
}) => {
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
  const postalCode = page.locator("#address_postal_code");
  await expect(postalCode).toBeVisible();
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  await postalCode.evaluate((input) => {
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
    const offset = input.getBoundingClientRect().bottom - innerHeight + 180;
    (scroller ?? document.scrollingElement)?.scrollBy({
      top: offset,
      behavior: "instant",
    });
    input.focus({ preventScroll: true });
  });

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
  expect(
    await list.evaluate((node) => node.scrollHeight > node.clientHeight)
  ).toBe(true);

  await list.getByRole("option", { name: /Beyenburg/ }).click();
  await expect(page.locator("#address_city")).toHaveValue("Beyenburg");
});
