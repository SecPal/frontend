// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Playwright helpers to drive the real onboarding wizard (schema-driven steps).
 * Keeps locale-agnostic selectors (EN + DE) where the UI is translated.
 */

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, type Page } from "@playwright/test";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_ONBOARDING_UPLOAD_FIXTURE = path.join(
  __dirname,
  "fixtures",
  "onboarding-e2e-1x1.png"
);

const NEXT_BTN = /^Next$|^Weiter$/;
const SUBMIT_REVIEW_BTN = /Submit for Review|Zur Überprüfung einreichen/;
const SKIP_STEP_BTN = /Skip this step|Diesen Schritt überspringen/;
const UPLOAD_FILE_BTN = /Upload File|Datei hochladen/;
const SCHEMA_BLOCK_RE =
  /schema we cannot render|Schema.*noch nicht.*dargestellt/i;

async function dismissOpenOverlays(page: Page): Promise<void> {
  await page.keyboard.press("Escape").catch(() => undefined);
}

async function clickRadioInGroup(
  page: Page,
  groupName: RegExp,
  choice: "yes" | "no"
): Promise<boolean> {
  const group = page.getByRole("radiogroup", { name: groupName });
  if (!(await group.isVisible().catch(() => false))) {
    return false;
  }
  const pattern = choice === "yes" ? /^(Yes|Ja)$/i : /^(No|Nein)$/i;
  const radio = group.getByRole("radio", { name: pattern });
  if (!(await radio.isVisible().catch(() => false))) {
    return false;
  }
  if (await radio.isChecked().catch(() => false)) {
    return true;
  }
  await radio.click();
  return true;
}

/** Prefer “no upload now” so most tenants can proceed without binary uploads. */
async function chooseDocumentUploadRadios(page: Page): Promise<void> {
  await clickRadioInGroup(
    page,
    /identity document now|Ausweisdokument jetzt/i,
    "no"
  );
  await clickRadioInGroup(
    page,
    /residence title now|Aufenthaltstitel jetzt hochladen/i,
    "no"
  );
}

async function chooseBewacherIdNo(page: Page): Promise<void> {
  await clickRadioInGroup(
    page,
    /Do you currently have a Bewacher|Besitzen Sie derzeit eine Bewacher-ID/i,
    "no"
  );
}

/** “Employment permitted” must be Yes when shown, otherwise the wizard blocks Next. */
async function chooseEmploymentPermittedYes(page: Page): Promise<void> {
  await clickRadioInGroup(
    page,
    /Employment permitted|Erwerbstätigkeit gestattet/i,
    "yes"
  );
}

/** Headless UI address fields use `<Input role="combobox">`; values must match OpenPLZ suggestions. */
async function pickFirstVisibleOptionAfterTyping(
  page: Page,
  input: import("@playwright/test").Locator,
  text: string
): Promise<void> {
  await input.click();
  await input.fill("");
  const responsePromise = page
    .waitForResponse(
      (r) =>
        /\/v1\/addresses\/de\/(localities|streets)/.test(r.url()) &&
        r.request().method() === "GET",
      { timeout: 25_000 }
    )
    .catch(() => undefined);
  await input.fill(text);
  await responsePromise;
  await page.waitForTimeout(150);
  const controlsId = (await input.getAttribute("aria-controls"))?.trim() ?? "";
  const opt =
    controlsId.length > 0
      ? page
          .locator(`#${controlsId}`)
          .getByRole("option")
          .first()
      : page.getByRole("option").first();
  try {
    await opt.waitFor({ state: "visible", timeout: 25_000 });
    await opt.click();
  } catch {
    await page.keyboard.press("Escape").catch(() => undefined);
  }
}

async function fillGermanAddressAutocomplete(page: Page): Promise<void> {
  const postal = page.getByLabel(/Postal Code|Postleitzahl/i);
  const nPostal = await postal.count();
  for (let i = 0; i < nPostal; i++) {
    const inp = postal.nth(i);
    if (!(await inp.isVisible().catch(() => false))) {
      continue;
    }
    if (await inp.isDisabled().catch(() => true)) {
      continue;
    }
    await pickFirstVisibleOptionAfterTyping(page, inp, "10115");
  }

  const city = page.getByLabel(/^City|Stadt/i);
  const nCity = await city.count();
  for (let i = 0; i < nCity; i++) {
    const inp = city.nth(i);
    if (!(await inp.isVisible().catch(() => false))) {
      continue;
    }
    if (await inp.isDisabled().catch(() => true)) {
      continue;
    }
    await pickFirstVisibleOptionAfterTyping(page, inp, "Berlin");
  }

  const street = page.getByLabel(/^Street|Straße|Strasse/i);
  const nStreet = await street.count();
  for (let i = 0; i < nStreet; i++) {
    const inp = street.nth(i);
    if (!(await inp.isVisible().catch(() => false))) {
      continue;
    }
    if (await inp.isDisabled().catch(() => true)) {
      continue;
    }
    await pickFirstVisibleOptionAfterTyping(page, inp, "Pariser Platz");
  }

  const house = page.getByLabel(/House Number|Hausnummer/i);
  const nHouse = await house.count();
  for (let i = 0; i < nHouse; i++) {
    const inp = house.nth(i);
    if (!(await inp.isVisible().catch(() => false))) {
      continue;
    }
    if (await inp.isDisabled().catch(() => true)) {
      continue;
    }
    const val = (await inp.inputValue().catch(() => "")) ?? "";
    if (!val.trim() || /e2e onboarding/i.test(val)) {
      await inp.fill("1");
    }
  }
}

async function fillNativeSelects(page: Page): Promise<void> {
  const selects = page.locator("select[name]:visible");
  const count = await selects.count();
  for (let i = 0; i < count; i++) {
    const sel = selects.nth(i);
    if (await sel.isDisabled().catch(() => true)) {
      continue;
    }
    const options = sel.locator("option:not([value=''])");
    const optCount = await options.count();
    if (optCount === 0) {
      continue;
    }
    const value = await options.nth(0).getAttribute("value");
    if (value) {
      await sel.selectOption(value);
    }
  }
}

async function fillTextLikeInputs(page: Page): Promise<void> {
  const inputs = page.locator(
    [
      'input[type="text"]:visible',
      "input:not([type]):visible",
      'input[type="search"]:visible',
      'input[type="tel"]:visible',
      'input[type="email"]:visible',
      'input[type="number"]:visible',
      'input[type="date"]:visible',
    ].join(", ")
  );
  const n = await inputs.count();
  for (let i = 0; i < n; i++) {
    const inp = inputs.nth(i);
    if (await inp.isDisabled().catch(() => true)) {
      continue;
    }
    const name = (await inp.getAttribute("name")) ?? "";
    if (!name || name.toLowerCase().includes("search")) {
      continue;
    }
    const type = (await inp.getAttribute("type")) ?? "text";
    const role = (await inp.getAttribute("role")) ?? "";
    const current = await inp.inputValue().catch(() => "");
    const lower = name.toLowerCase();
    // OpenPLZ comboboxes: never apply generic text; `fillGermanAddressAutocomplete` drives them.
    if (
      role === "combobox" &&
      (lower.includes("postal_code") ||
        lower.includes("_city") ||
        lower.includes("_street"))
    ) {
      continue;
    }
    if (type === "date") {
      if (current.trim()) {
        continue;
      }
      if (/resided_from|resided_until|wohnhaft|living/i.test(name)) {
        await inp.fill("2015-01-01");
      } else {
        await inp.fill("2032-12-31");
      }
      continue;
    }
    if (type === "number") {
      if (!current.trim()) {
        await inp.fill("1");
      }
      continue;
    }
    if (!current.trim()) {
      if (lower.includes("email")) {
        await inp.fill("onboarding-wizard-e2e@example.com");
      } else if (
        lower.includes("phone") ||
        lower.includes("telefon") ||
        lower.includes("mobile")
      ) {
        await inp.fill("+4930123456789");
      } else if (
        lower.includes("postal") ||
        lower === "plz" ||
        lower.includes("postleitzahl")
      ) {
        await inp.fill("10115");
      } else if (lower === "iban" || lower.endsWith("_iban")) {
        await inp.fill("DE89370400440532013000");
      } else if (
        lower === "bic" ||
        lower.includes("swift") ||
        lower.endsWith("_bic")
      ) {
        await inp.fill("COBADEFFXXX");
      } else if (
        lower.includes("tax_identification") ||
        lower.includes("tax_id") ||
        lower === "tin" ||
        lower.endsWith("_tin") ||
        (lower.includes("tax") && lower.includes("identification")) ||
        lower.includes("steueridentifikation") ||
        lower.includes("steuer_id")
      ) {
        // Client schema often `^\d{11}$` (German Steuer-ID length).
        await inp.fill("12345678901");
      } else if (
        lower.includes("social_security") ||
        lower.includes("rentenversicherungsnummer") ||
        lower.includes("sozialversicherungsnummer")
      ) {
        // Matches `^\d{2}\s?\d{6}\s?[A-Z]\s?\d{3}$` (German SVNR shape).
        await inp.fill("46171234B987");
      } else if (
        lower.includes("house_number") ||
        lower.includes("hausnummer") ||
        /\bhouse_number\b/.test(lower)
      ) {
        await inp.fill("1");
      } else if (
        lower.includes("_city") ||
        /(^|[._])city$/.test(lower)
      ) {
        await inp.fill("Berlin");
      } else if (
        lower.includes("street") ||
        lower.includes("straße") ||
        lower.includes("strasse")
      ) {
        await inp.fill("Pariser Platz");
      } else if (
        lower.includes("first_name") ||
        lower === "firstname" ||
        lower === "given_name"
      ) {
        await inp.fill("John");
      } else if (
        lower.includes("last_name") ||
        lower === "lastname" ||
        lower === "family_name"
      ) {
        await inp.fill("Doe");
      } else {
        await inp.fill("E2E Onboarding");
      }
    } else if (
      lower === "iban" ||
      lower.endsWith("_iban") ||
      lower === "bic" ||
      lower.includes("swift") ||
      lower.endsWith("_bic")
    ) {
      // Overwrite invalid placeholder values from earlier passes.
      if (lower === "iban" || lower.endsWith("_iban")) {
        await inp.fill("DE89370400440532013000");
      } else {
        await inp.fill("COBADEFFXXX");
      }
    } else if (
      lower.includes("tax_identification") ||
      lower.includes("tax_id") ||
      lower === "tin" ||
      lower.endsWith("_tin") ||
      (lower.includes("tax") && lower.includes("identification")) ||
      lower.includes("steueridentifikation") ||
      lower.includes("steuer_id")
    ) {
      await inp.fill("12345678901");
    } else if (
      lower.includes("social_security") ||
      lower.includes("rentenversicherungsnummer") ||
      lower.includes("sozialversicherungsnummer")
    ) {
      await inp.fill("46171234B987");
    } else if (
      lower.includes("house_number") ||
      lower.includes("hausnummer") ||
      /\bhouse_number\b/.test(lower)
    ) {
      await inp.fill("1");
    } else if (
      lower.includes("_city") ||
      /(^|[._])city$/.test(lower)
    ) {
      await inp.fill("Berlin");
    } else if (
      lower.includes("_street") ||
      /(^|[._])street$/.test(lower) ||
      lower.includes("straße") ||
      lower.includes("strasse")
    ) {
      await inp.fill("Pariser Platz");
    }
  }
}

async function fillTextareas(page: Page): Promise<void> {
  const areas = page.locator("textarea[name]:visible");
  const n = await areas.count();
  for (let i = 0; i < n; i++) {
    const ta = areas.nth(i);
    if (await ta.isDisabled().catch(() => true)) {
      continue;
    }
    if (!(await ta.inputValue()).trim()) {
      await ta.fill("Line 1\nLine 2");
    }
  }
}

async function fillComboboxes(page: Page): Promise<void> {
  const combos = page.getByRole("combobox");
  const n = await combos.count();
  for (let i = 0; i < n; i++) {
    const box = combos.nth(i);
    if (!(await box.isVisible().catch(() => false))) {
      continue;
    }
    if (await box.isDisabled().catch(() => true)) {
      continue;
    }
    // Headless UI can expose native <select> with role="combobox"; .fill() is not supported.
    const isNativeSelect = await box
      .evaluate((el) => el.tagName.toLowerCase() === "select")
      .catch(() => false);
    if (isNativeSelect) {
      continue;
    }

    const aria = ((await box.getAttribute("aria-label")) ?? "").trim();
    const nameAttr = ((await box.getAttribute("name")) ?? "").toLowerCase();
    // OpenPLZ address fields: do not run generic country search (corrupts PLZ/city/street).
    if (
      nameAttr.includes("postal_code") ||
      nameAttr.includes("_city") ||
      /(^|[._])city$/.test(nameAttr) ||
      nameAttr.includes("_street") ||
      /(^|[._])street$/.test(nameAttr)
    ) {
      continue;
    }

    const val = await box.inputValue().catch(() => "");
    if (val.trim().length > 0) {
      continue;
    }

    const isNationality = /nationalities|nationality|staatsangehörigkeit/i.test(
      aria
    );
    const isCountry = /^country$/i.test(aria) || /^land$/i.test(aria);

    const searchTerms = isNationality
      ? ["Germany", "Deutschland", "DE"]
      : isCountry
        ? ["Germany", "Deutschland", "DE"]
        : ["Germany", "DE"];

    const optionPattern =
      isNationality || isCountry
        ? /Deutschland|\(DE\)|Germany|United States|\(US\)/i
        : /Deutschland|\(DE\)|Germany|\(US\)|United States/i;

    let filled = false;
    for (const term of searchTerms) {
      await box.click();
      await box.fill("");
      await box.fill(term);
      const opt = page.getByRole("option", { name: optionPattern }).first();
      try {
        await opt.waitFor({ state: "visible", timeout: 15_000 });
        await opt.click();
        filled = true;
        break;
      } catch {
        await page.keyboard.press("ArrowDown").catch(() => undefined);
        await page.keyboard.press("Enter").catch(() => undefined);
        const after = await box.inputValue().catch(() => "");
        if (after.trim().length > 0) {
          filled = true;
          break;
        }
      }
    }

    if (!filled) {
      await box.click();
      await page.keyboard.press("ArrowDown").catch(() => undefined);
      await page.keyboard.press("Enter").catch(() => undefined);
    }

    await page.keyboard.press("Escape").catch(() => undefined);
  }
}

async function tryUploadFirstVisibleAttachment(
  page: Page,
  fixturePath: string
): Promise<boolean> {
  const primary = page.locator('input[type="file"]').first();
  if (!(await primary.isVisible().catch(() => false))) {
    return false;
  }
  await primary.setInputFiles(fixturePath);
  const uploadBtn = page.getByRole("button", { name: UPLOAD_FILE_BTN });
  if (!(await uploadBtn.isEnabled().catch(() => false))) {
    return false;
  }
  await uploadBtn.click();
  await page
    .getByText(/uploaded successfully|hochgeladen/i)
    .first()
    .waitFor({ state: "visible", timeout: 120_000 })
    .catch(() => undefined);
  return true;
}

async function ensureNationalityComboboxFilled(page: Page): Promise<void> {
  const combo = page.getByRole("combobox", {
    name: /Nationalities|Nationality|Staatsangehörigkeit/i,
  });
  if (!(await combo.first().isVisible().catch(() => false))) {
    return;
  }
  const target = combo.first();
  const isNativeSelect = await target
    .evaluate((el) => el.tagName.toLowerCase() === "select")
    .catch(() => false);
  if (isNativeSelect) {
    return;
  }
  const current = await target.inputValue().catch(() => "");
  if (current.trim().length > 0) {
    return;
  }
  for (const term of ["Germany", "Deutschland", "DE"]) {
    await target.click();
    await target.fill("");
    await target.fill(term);
    const opt = page
      .getByRole("option", { name: /Deutschland|\(DE\)|Germany/i })
      .first();
    try {
      await opt.waitFor({ state: "visible", timeout: 15_000 });
      await opt.click();
      return;
    } catch {
      await page.keyboard.press("ArrowDown").catch(() => undefined);
      await page.keyboard.press("Enter").catch(() => undefined);
      if (((await target.inputValue().catch(() => "")) ?? "").trim().length > 0) {
        return;
      }
    }
  }
}

async function fillLiveOnboardingStepOnce(
  page: Page,
  fixturePath: string
): Promise<void> {
  await chooseBewacherIdNo(page);
  await fillNativeSelects(page);
  await fillGermanAddressAutocomplete(page);
  await fillTextLikeInputs(page);
  await fillTextareas(page);
  await fillComboboxes(page);
  await ensureNationalityComboboxFilled(page);
  await fillComboboxes(page);
  // Native <select role="combobox"> is skipped above; run again after other fills.
  await fillNativeSelects(page);
  await chooseEmploymentPermittedYes(page);
  // Shown only after nationality / residence fields on some steps — run late so radios exist.
  await chooseDocumentUploadRadios(page);
  await fillGermanAddressAutocomplete(page);
  await dismissOpenOverlays(page);

  const nextBtn = page.getByRole("button", { name: NEXT_BTN });
  const nextVisible = await nextBtn.isVisible().catch(() => false);
  // Last wizard step has no Next button (only Submit). Treat missing Next as "not blocked by Next".
  if (
    nextVisible &&
    !(await nextBtn.isEnabled().catch(() => false))
  ) {
    await tryUploadFirstVisibleAttachment(page, fixturePath);
  }
}

export async function waitForOnboardingShellReady(page: Page): Promise<void> {
  await page
    .getByRole("heading", {
      name: /Welcome to SecPal Onboarding|Willkommen zum SecPal Onboarding/i,
    })
    .waitFor({ state: "visible", timeout: 120_000 });
  await page
    .getByText(/Loading onboarding|Lade.*Onboarding/i)
    .waitFor({ state: "hidden", timeout: 120_000 })
    .catch(() => undefined);
}

export async function assertNoUnsupportedSchemaBanner(page: Page): Promise<void> {
  const banner = page.getByText(SCHEMA_BLOCK_RE);
  if (await banner.isVisible().catch(() => false)) {
    throw new Error(
      "Onboarding step uses a schema the wizard cannot render yet (see OnboardingWizard unsupported-schema banner)."
    );
  }
}

/**
 * Iterates wizard steps: fills visible fields, uses Next / optional Skip, submits on the last step.
 */
export async function completeLiveOnboardingWizard(
  page: Page,
  options?: { fixturePath?: string; maxIterations?: number }
): Promise<void> {
  const fixturePath = options?.fixturePath ?? DEFAULT_ONBOARDING_UPLOAD_FIXTURE;
  const maxIterations = options?.maxIterations ?? 45;

  if (page.url().includes("/onboarding/submitted")) {
    return;
  }

  await waitForOnboardingShellReady(page);

  if (page.url().includes("/onboarding/submitted")) {
    return;
  }

  for (let i = 0; i < maxIterations; i++) {
    if (page.url().includes("/onboarding/submitted")) {
      return;
    }

    await assertNoUnsupportedSchemaBanner(page);
    await page
      .getByText(/Loading onboarding|Lade.*Onboarding/i)
      .waitFor({ state: "hidden", timeout: 120_000 })
      .catch(() => undefined);

    for (let pass = 0; pass < 10; pass++) {
      await fillLiveOnboardingStepOnce(page, fixturePath);
      const next = page.getByRole("button", { name: NEXT_BTN });
      const submit = page.getByRole("button", { name: SUBMIT_REVIEW_BTN });
      if (
        (await next.isVisible().catch(() => false)) &&
        (await next.isEnabled().catch(() => false))
      ) {
        break;
      }
      if (
        (await submit.isVisible().catch(() => false)) &&
        (await submit.isEnabled().catch(() => false))
      ) {
        break;
      }
      await page.waitForTimeout(250);
    }

    const submit = page.getByRole("button", { name: SUBMIT_REVIEW_BTN });
    const next = page.getByRole("button", { name: NEXT_BTN });
    const skip = page.getByRole("button", { name: SKIP_STEP_BTN });

    if (
      (await submit.isVisible().catch(() => false)) &&
      (await submit.isEnabled().catch(() => false))
    ) {
      const responsePromise = page.waitForResponse(
        (response) =>
          /\/v1\/onboarding\/submissions/i.test(response.url()) &&
          ["PATCH", "POST"].includes(response.request().method()),
        { timeout: 180_000 }
      );

      await submit.click();
      let submissionResponse: import("@playwright/test").Response;
      try {
        submissionResponse = await responsePromise;
      } catch {
        const advisory =
          (await page
            .getByRole("alert")
            .first()
            .innerText()
            .catch(() => "")) ?? "";
        throw new Error(
          `Timed out waiting for onboarding submission PATCH/POST after Submit. ${advisory.slice(0, 800)}`
        );
      }

      if (!submissionResponse.ok()) {
        const body = await submissionResponse.text().catch(() => "");

        // Live tenants can reject submit until the wizard exposes follow-up
        // fields; keep iterating so the helper can fill the highlighted step.
        if (submissionResponse.status() === 422) {
          await page.waitForLoadState("networkidle").catch(() => undefined);
          await page.waitForTimeout(1_000);
          continue;
        }

        throw new Error(
          `Onboarding submission ${submissionResponse.request().method()} failed (${submissionResponse.status()}): ${body.slice(0, 1500)}. ` +
            "If this mentions workflow state, align `onboarding_workflow.status` for the E2E employee in the API (see contrib/secpal-api/README.md)."
        );
      }

      try {
        await page.waitForURL(/\/onboarding\/submitted/i, {
          timeout: 30_000,
        });
        return;
      } catch {
        await page.waitForLoadState("networkidle").catch(() => undefined);
        continue;
      }
    }

    if (
      (await next.isVisible().catch(() => false)) &&
      (await next.isEnabled().catch(() => false))
    ) {
      const stepHeading = page.getByRole("heading", { level: 2 }).first();
      const beforeTitle =
        (await stepHeading.textContent().catch(() => "")) ?? "";

      const responsePromise = page.waitForResponse(
        (response) =>
          /\/v1\/onboarding\/submissions/i.test(response.url()) &&
          ["PATCH", "POST"].includes(response.request().method()),
        { timeout: 180_000 }
      );

      await next.click();
      let submissionResponse: import("@playwright/test").Response;
      try {
        submissionResponse = await responsePromise;
      } catch {
        const advisory =
          (await page
            .getByRole("alert")
            .first()
            .innerText()
            .catch(() => "")) ?? "";
        throw new Error(
          `Timed out waiting for onboarding submission PATCH/POST after Next. ${advisory.slice(0, 800)}`
        );
      }
      if (!submissionResponse.ok()) {
        const body = await submissionResponse.text().catch(() => "");
        throw new Error(
          `Onboarding submission ${submissionResponse.request().method()} failed (${submissionResponse.status()}): ${body.slice(0, 1500)}. ` +
            "If this mentions workflow state, align `onboarding_workflow.status` for the E2E employee in the API (see contrib/secpal-api/README.md)."
        );
      }

      if (beforeTitle.trim().length > 0) {
        await expect(stepHeading).not.toHaveText(beforeTitle, {
          timeout: 180_000,
        });
      } else {
        await page.waitForTimeout(1500);
      }
      continue;
    }

    if (
      (await skip.isVisible().catch(() => false)) &&
      (await skip.isEnabled().catch(() => false))
    ) {
      await skip.click();
      await page.waitForTimeout(800);
      continue;
    }

    await fillLiveOnboardingStepOnce(page, fixturePath);
    if (
      (await next.isEnabled().catch(() => false)) ||
      (await submit.isEnabled().catch(() => false))
    ) {
      continue;
    }

    throw new Error(
      `Live onboarding wizard stalled after ${i + 1} iteration(s): neither enabled Next/Submit nor Skip. ` +
        "Check required fields, uploads, or API validation for this tenant."
    );
  }

  throw new Error(
    `Live onboarding wizard did not reach /onboarding/submitted within ${maxIterations} iterations.`
  );
}
