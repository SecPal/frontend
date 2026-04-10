// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { TEST_USER, loginViaUI } from "./auth.setup";

const API_BASE_URL =
  process.env.PLAYWRIGHT_API_BASE_URL || "https://api.secpal.dev";
const LIVE_PASSKEY_ENABLED = process.env.PLAYWRIGHT_LIVE_PASSKEY === "1";
const PASSKEY_LABEL_PREFIX = "Live E2E Passkey";
const PASSKEY_RATE_LIMIT_MESSAGE = /too many passkey attempts/i;
const PASSKEY_RATE_LIMIT_WAIT_MS = 610_000;

interface RecordedExchange {
  url: string;
  method: string;
  payload: unknown;
  status: number;
  responseBody: unknown;
}

interface PasskeyTraffic {
  registrationVerify: RecordedExchange[];
  loginVerify: RecordedExchange[];
  passkeyList: RecordedExchange[];
}

function createPasskeyTraffic(): PasskeyTraffic {
  return {
    registrationVerify: [],
    loginVerify: [],
    passkeyList: [],
  };
}

function parseJson<T>(value: string | null): T | string | null {
  if (value === null || value.trim() === "") {
    return value;
  }

  try {
    return JSON.parse(value) as T;
  } catch {
    return value;
  }
}

function observePasskeyTraffic(page: Page, traffic: PasskeyTraffic) {
  page.on("response", async (response) => {
    const url = response.url();
    const method = response.request().method();
    const payload = parseJson(response.request().postData() ?? null);
    const responseBody = parseJson(await response.text().catch(() => null));

    const exchange: RecordedExchange = {
      url,
      method,
      payload,
      status: response.status(),
      responseBody,
    };

    if (
      url.includes("/v1/me/passkeys/challenges/registration/") &&
      url.endsWith("/verify")
    ) {
      traffic.registrationVerify.push(exchange);
      return;
    }

    if (
      url.includes("/v1/auth/passkeys/challenges/") &&
      url.endsWith("/verify")
    ) {
      traffic.loginVerify.push(exchange);
      return;
    }

    if (url.includes("/v1/me/passkeys") && !url.includes("/challenges/")) {
      traffic.passkeyList.push(exchange);
    }
  });
}

async function installVirtualAuthenticator(page: Page) {
  const cdp = await page.context().newCDPSession(page);

  await cdp.send("WebAuthn.enable");

  const { authenticatorId } = await cdp.send(
    "WebAuthn.addVirtualAuthenticator",
    {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: true,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    }
  );

  return { cdp, authenticatorId };
}

async function removeVirtualAuthenticator(page: Page, authenticatorId: string) {
  const cdp = await page.context().newCDPSession(page);

  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.removeVirtualAuthenticator", { authenticatorId });
}

async function swapVirtualAuthenticator(
  page: Page,
  authenticatorId: string | null
): Promise<string> {
  if (authenticatorId !== null) {
    await removeVirtualAuthenticator(page, authenticatorId);
  }

  const nextAuthenticator = await installVirtualAuthenticator(page);

  return nextAuthenticator.authenticatorId;
}

async function getApiPasskeyLabels(page: Page): Promise<string[]> {
  return await page.evaluate(async (apiBaseUrl) => {
    const response = await fetch(`${apiBaseUrl}/v1/me/passkeys`, {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch passkeys: ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ label?: string }>;
    };

    return (payload.data ?? [])
      .map((credential) => credential.label)
      .filter((label): label is string => typeof label === "string");
  }, API_BASE_URL);
}

async function getAuthenticatedUser(
  page: Page
): Promise<{ email: string } | null> {
  return await page.evaluate(async (apiBaseUrl) => {
    const response = await fetch(`${apiBaseUrl}/v1/me`, {
      credentials: "include",
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as { email: string };
  }, API_BASE_URL);
}

async function openSettings(page: Page) {
  await page.goto("/settings", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: /passkeys/i })).toBeVisible();
}

async function addPasskey(page: Page, label: string) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const addButton = page.getByRole("button", { name: /add passkey/i });

    await page.getByLabel(/passkey label/i).fill(label);
    await addButton.click();

    try {
      await expect(page.getByText(label)).toBeVisible({ timeout: 20_000 });
      await expect(
        page.getByRole("button", { name: /adding passkey/i })
      ).toHaveCount(0);
      await expect(addButton).toHaveText(/add passkey/i, { timeout: 20_000 });
      await expect(addButton).toBeEnabled();

      return;
    } catch (error) {
      const rateLimited = await page
        .getByText(PASSKEY_RATE_LIMIT_MESSAGE)
        .isVisible()
        .catch(() => false);

      if (!rateLimited || attempt === 1) {
        throw error;
      }

      await page.waitForTimeout(PASSKEY_RATE_LIMIT_WAIT_MS);
      await openSettings(page);
    }
  }
}

async function removePasskey(page: Page, label: string) {
  const card = page
    .locator("div.rounded-2xl")
    .filter({ hasText: label })
    .first();
  const removeButton = card.getByRole("button", { name: /remove|removing/i });

  await expect(card).toBeVisible();
  await removeButton.click();

  await expect(page.getByText(label)).toHaveCount(0, { timeout: 20_000 });
}

async function clearBrowserAuthState(page: Page, context: BrowserContext) {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await context.clearCookies();
}

test.describe("Live passkey proof", () => {
  test.skip(
    !LIVE_PASSKEY_ENABLED,
    "Set PLAYWRIGHT_LIVE_PASSKEY=1 to run the live passkey proof against app.secpal.dev/api.secpal.dev."
  );

  test.describe.configure({ mode: "serial" });

  test("proves registration, consistency, removal, and email-first login against the live stack", async ({
    page,
    context,
  }) => {
    test.slow();
    test.setTimeout(900_000);

    if (!TEST_USER.email || !TEST_USER.password) {
      throw new Error(
        "TEST_USER_EMAIL and TEST_USER_PASSWORD must be set for the live passkey proof."
      );
    }

    const runId = Date.now();
    const firstLabel = `${PASSKEY_LABEL_PREFIX} ${runId} A`;
    const secondLabel = `${PASSKEY_LABEL_PREFIX} ${runId} B`;
    let activeAuthenticatorId: string | null = null;
    const traffic = createPasskeyTraffic();

    observePasskeyTraffic(page, traffic);

    try {
      await test.step("log in with the real password flow", async () => {
        await loginViaUI(page, TEST_USER.email, TEST_USER.password);
        await expect(page).not.toHaveURL(/\/login$/);
      });

      await test.step("register two live passkeys and verify UI plus API persistence", async () => {
        await openSettings(page);

        activeAuthenticatorId = await swapVirtualAuthenticator(
          page,
          activeAuthenticatorId
        );
        await addPasskey(page, firstLabel);

        expect(traffic.registrationVerify).toHaveLength(1);
        expect(traffic.registrationVerify[0]?.status).toBe(201);
        expect(traffic.registrationVerify[0]?.payload).toEqual(
          expect.objectContaining({
            label: firstLabel,
            credential: expect.objectContaining({
              id: expect.any(String),
              raw_id: expect.any(String),
              response: expect.objectContaining({
                client_data_json: expect.any(String),
                attestation_object: expect.any(String),
              }),
            }),
          })
        );
        expect(traffic.registrationVerify[0]?.responseBody).toEqual(
          expect.objectContaining({
            data: expect.objectContaining({
              credential: expect.objectContaining({
                label: firstLabel,
              }),
            }),
          })
        );

        activeAuthenticatorId = await swapVirtualAuthenticator(
          page,
          activeAuthenticatorId
        );
        await addPasskey(page, secondLabel);

        expect(traffic.registrationVerify).toHaveLength(2);
        expect(traffic.registrationVerify[1]?.status).toBe(201);
        expect(traffic.registrationVerify[1]?.payload).toEqual(
          expect.objectContaining({
            label: secondLabel,
            credential: expect.objectContaining({
              id: expect.any(String),
              raw_id: expect.any(String),
            }),
          })
        );
        expect(traffic.passkeyList.length).toBeGreaterThanOrEqual(3);

        const apiLabels = await getApiPasskeyLabels(page);

        expect(apiLabels).toContain(firstLabel);
        expect(apiLabels).toContain(secondLabel);
        await expect(page.getByText(firstLabel)).toBeVisible();
        await expect(page.getByText(secondLabel)).toBeVisible();
      });

      await test.step("remove one live passkey and keep UI plus API in sync", async () => {
        await removePasskey(page, firstLabel);

        const apiLabels = await getApiPasskeyLabels(page);

        expect(apiLabels).not.toContain(firstLabel);
        expect(apiLabels).toContain(secondLabel);
        await expect(page.getByText(secondLabel)).toBeVisible();
      });

      await test.step("clear local auth state and complete email-first passkey login", async () => {
        await clearBrowserAuthState(page, context);
        await page.goto("/login", { waitUntil: "networkidle" });

        await page.getByLabel(/email/i).fill(TEST_USER.email);
        await page
          .getByRole("button", { name: /sign in with passkey/i })
          .click();

        await page.waitForURL((url) => !url.pathname.includes("/login"), {
          timeout: 20_000,
        });

        await expect(page).not.toHaveURL(/\/login$/);
        await expect(page.getByText(/welcome to secpal/i)).toBeVisible();

        expect(traffic.loginVerify).toHaveLength(1);
        expect(traffic.loginVerify[0]?.status).toBe(200);
        expect(traffic.loginVerify[0]?.payload).toEqual(
          expect.objectContaining({
            credential: expect.objectContaining({
              id: expect.any(String),
              raw_id: expect.any(String),
              response: expect.objectContaining({
                client_data_json: expect.any(String),
                authenticator_data: expect.any(String),
                signature: expect.any(String),
              }),
            }),
          })
        );
        expect(traffic.loginVerify[0]?.responseBody).toEqual(
          expect.objectContaining({
            authentication: expect.objectContaining({
              mode: "session",
              method: "passkey",
              mfa_completed: true,
            }),
            user: expect.objectContaining({
              email: TEST_USER.email,
            }),
          })
        );

        const authenticatedUser = await getAuthenticatedUser(page);

        expect(authenticatedUser).toEqual(
          expect.objectContaining({ email: TEST_USER.email })
        );
      });

      await test.step("clean up the remaining live passkey", async () => {
        await openSettings(page);
        await removePasskey(page, secondLabel);

        const apiLabels = await getApiPasskeyLabels(page);

        expect(apiLabels).not.toContain(secondLabel);
      });
    } finally {
      if (activeAuthenticatorId !== null) {
        await removeVirtualAuthenticator(page, activeAuthenticatorId);
      }
    }
  });
});
