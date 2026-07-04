// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { expect, test, type Page, type Route } from "@playwright/test";
import { installStoredAuthUser } from "../utils/passkeyAuthStorage";

const AUTH_STORAGE_CSRF_TOKEN = "playwright-test-csrf-token";

const authUser = {
  id: "1",
  name: "Test User",
  email: "test@example.com",
  emailVerified: true,
  roles: [],
  permissions: [],
  hasOrganizationalScopes: false,
  hasCustomerAccess: false,
  hasSiteAccess: false,
};

const registrationChallenge = {
  data: {
    challenge_id: "550e8400-e29b-41d4-a716-446655440099",
    public_key: {
      challenge: "Zm9vYmFy",
      rp: {
        id: "app.secpal.dev",
        name: "SecPal",
      },
      user: {
        id: "dXNlci1pZA",
        name: "test@example.com",
        display_name: "Test User",
      },
      pub_key_cred_params: [{ type: "public-key", alg: -7 }],
      timeout: 60000,
      authenticator_selection: {
        resident_key: "preferred",
        user_verification: "preferred",
      },
      attestation: "none",
    },
    expires_at: "2026-04-09T17:00:00Z",
  },
};

const registrationVerification = {
  data: {
    credential: {
      id: "bmV3LWNyZWRlbnRpYWwtaWQ",
      label: "Security Key",
      created_at: "2026-04-09T17:00:00Z",
      last_used_at: null,
      transports: ["internal"],
    },
    total_passkeys: 1,
  },
};

const authenticationChallenge = {
  data: {
    challenge_id: "550e8400-e29b-41d4-a716-446655440001",
    public_key: {
      challenge: "Zm9vYmFy",
      rp_id: "app.secpal.dev",
      timeout: 60000,
      user_verification: "preferred",
    },
    mediation: "optional",
    expires_at: "2026-04-09T17:00:00Z",
  },
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

async function installPasskeyBrowserMocks(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isSecureContext", {
      configurable: true,
      value: true,
    });

    class PublicKeyCredentialMock {}

    Object.defineProperty(window, "PublicKeyCredential", {
      configurable: true,
      value: PublicKeyCredentialMock,
    });

    Object.defineProperty(navigator, "credentials", {
      configurable: true,
      value: {
        create: async () => ({
          id: "new-credential-id",
          rawId: Uint8Array.from([114, 97, 119, 45, 105, 100]).buffer,
          type: "public-key",
          response: {
            clientDataJSON: Uint8Array.from([99, 108, 105, 101, 110, 116])
              .buffer,
            attestationObject: Uint8Array.from([
              97, 116, 116, 101, 115, 116, 97, 116, 105, 111, 110,
            ]).buffer,
            getTransports: () => ["internal"],
          },
          getClientExtensionResults: () => ({}),
        }),
        get: async () => ({
          id: "credential-id",
          rawId: Uint8Array.from([114, 97, 119, 45, 105, 100]).buffer,
          type: "public-key",
          response: {
            clientDataJSON: Uint8Array.from([99, 108, 105, 101, 110, 116])
              .buffer,
            authenticatorData: Uint8Array.from([
              97, 117, 116, 104, 101, 110, 116, 105, 99, 97, 116, 111, 114,
            ]).buffer,
            signature: Uint8Array.from([
              115, 105, 103, 110, 97, 116, 117, 114, 101,
            ]).buffer,
            userHandle: null,
          },
          getClientExtensionResults: () => ({}),
        }),
      },
    });
  });
}

test.describe("Passkeys", () => {
  test("registers a passkey and refreshes the enrolled list", async ({
    page,
  }) => {
    await installPasskeyBrowserMocks(page);
    await installStoredAuthUser(page, authUser, AUTH_STORAGE_CSRF_TOKEN);

    let passkeyListCalls = 0;

    await page.route("**/health/ready", async (route) => {
      await fulfillJson(route, {
        status: "ready",
        checks: {
          database: "ok",
          tenant_keys: "ok",
          kek_file: "ok",
        },
        timestamp: "2026-04-09T17:00:00Z",
      });
    });
    await page.route("**/v1/me", async (route) => {
      await fulfillJson(route, authUser);
    });
    await page.route("**/v1/me/mfa", async (route) => {
      await fulfillJson(route, {
        data: {
          enabled: false,
          method: null,
          recovery_codes_remaining: 0,
          recovery_codes_generated_at: null,
          enrolled_at: null,
        },
      });
    });
    await page.route("**/v1/me/passkeys", async (route) => {
      passkeyListCalls += 1;

      await fulfillJson(route, {
        data:
          passkeyListCalls === 1
            ? []
            : [registrationVerification.data.credential],
      });
    });
    await page.route(
      "**/v1/me/passkeys/challenges/registration",
      async (route) => {
        await fulfillJson(route, registrationChallenge, 201);
      }
    );
    await page.route(
      "**/v1/me/passkeys/challenges/registration/550e8400-e29b-41d4-a716-446655440099/verify",
      async (route) => {
        await fulfillJson(route, registrationVerification, 201);
      }
    );
    await page.route("**/sanctum/csrf-cookie", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });

    await page.goto("/settings");

    await expect(
      page.getByRole("heading", { name: /passkeys/i })
    ).toBeVisible();
    await page.getByLabel(/passkey label/i).fill("Security Key");
    await page.getByRole("button", { name: /add passkey/i }).click();

    await expect(page.getByText(/security key/i)).toBeVisible();
    await expect(page.getByText(/no passkeys enrolled yet/i)).toHaveCount(0);
    expect(passkeyListCalls).toBe(2);
  });

  test("signs in with a passkey through the browser flow", async ({ page }) => {
    await installPasskeyBrowserMocks(page);

    await page.route("**/health/ready", async (route) => {
      await fulfillJson(route, {
        status: "ready",
        checks: {
          database: "ok",
          tenant_keys: "ok",
          kek_file: "ok",
        },
        timestamp: "2026-04-09T17:00:00Z",
      });
    });
    await page.route("**/sanctum/csrf-cookie", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.route("**/v1/auth/passkeys/challenges", async (route) => {
      await fulfillJson(route, authenticationChallenge, 201);
    });
    await page.route(
      "**/v1/auth/passkeys/challenges/550e8400-e29b-41d4-a716-446655440001/verify",
      async (route) => {
        await fulfillJson(route, {
          user: authUser,
          authentication: {
            mode: "session",
            method: "passkey",
            mfa_completed: true,
          },
        });
      }
    );

    await page.goto("/login");

    await expect(
      page.getByRole("button", { name: /sign in with passkey/i })
    ).toBeVisible();
    await page.getByRole("button", { name: /sign in with passkey/i }).click();

    await expect(page).not.toHaveURL(/\/login$/);
  });

  test("ignores a typed email and always starts the public passkey challenge without a body", async ({
    page,
  }) => {
    await installPasskeyBrowserMocks(page);

    const publicChallengeBodies: Array<string | null> = [];

    await page.route("**/health/ready", async (route) => {
      await fulfillJson(route, {
        status: "ready",
        checks: {
          database: "ok",
          tenant_keys: "ok",
          kek_file: "ok",
        },
        timestamp: "2026-04-09T17:00:00Z",
      });
    });
    await page.route("**/sanctum/csrf-cookie", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.route("**/v1/auth/passkeys/challenges", async (route) => {
      publicChallengeBodies.push(route.request().postData());
      await fulfillJson(route, authenticationChallenge, 201);
    });
    await page.route(
      "**/v1/auth/passkeys/challenges/550e8400-e29b-41d4-a716-446655440001/verify",
      async (route) => {
        await fulfillJson(route, {
          user: authUser,
          authentication: {
            mode: "session",
            method: "passkey",
            mfa_completed: true,
          },
        });
      }
    );

    await page.goto("/login");

    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByRole("button", { name: /sign in with passkey/i }).click();

    await expect(page).not.toHaveURL(/\/login$/);
    expect(publicChallengeBodies).toEqual([null]);
  });

  test("keeps registration persistence and discoverable login lookup in sync", async ({
    page,
  }) => {
    await installPasskeyBrowserMocks(page);
    await installStoredAuthUser(page, authUser, AUTH_STORAGE_CSRF_TOKEN);

    let storedPasskeys: Array<typeof registrationVerification.data.credential> =
      [];

    await page.route("**/health/ready", async (route) => {
      await fulfillJson(route, {
        status: "ready",
        checks: {
          database: "ok",
          tenant_keys: "ok",
          kek_file: "ok",
        },
        timestamp: "2026-04-09T17:00:00Z",
      });
    });
    await page.route("**/sanctum/csrf-cookie", async (route) => {
      await route.fulfill({ status: 204, body: "" });
    });
    await page.route("**/v1/me", async (route) => {
      await fulfillJson(route, authUser);
    });
    await page.route("**/v1/me/mfa", async (route) => {
      await fulfillJson(route, {
        data: {
          enabled: false,
          method: null,
          recovery_codes_remaining: 0,
          recovery_codes_generated_at: null,
          enrolled_at: null,
        },
      });
    });
    await page.route("**/v1/me/passkeys", async (route) => {
      await fulfillJson(route, { data: storedPasskeys });
    });
    await page.route(
      "**/v1/me/passkeys/challenges/registration",
      async (route) => {
        await fulfillJson(route, registrationChallenge, 201);
      }
    );
    await page.route(
      "**/v1/me/passkeys/challenges/registration/550e8400-e29b-41d4-a716-446655440099/verify",
      async (route) => {
        storedPasskeys = [registrationVerification.data.credential];
        await fulfillJson(route, registrationVerification, 201);
      }
    );
    await page.route("**/v1/auth/passkeys/challenges", async (route) => {
      const rawBody = route.request().postData();

      if (rawBody !== null) {
        await fulfillJson(
          route,
          {
            message:
              "Email-scoped public passkey challenges are no longer supported.",
            errors: {
              email: [
                "Email-scoped public passkey challenges are no longer supported.",
              ],
            },
          },
          422
        );
        return;
      }

      await fulfillJson(route, authenticationChallenge, 201);
    });
    await page.route(
      "**/v1/auth/passkeys/challenges/550e8400-e29b-41d4-a716-446655440001/verify",
      async (route) => {
        await fulfillJson(route, {
          user: authUser,
          authentication: {
            mode: "session",
            method: "passkey",
            mfa_completed: true,
          },
        });
      }
    );

    await page.goto("/settings");

    await page.getByLabel(/passkey label/i).fill("Security Key");
    await page.getByRole("button", { name: /add passkey/i }).click();
    await expect(page.getByText(/security key/i)).toBeVisible();

    await page.evaluate(() => {
      window.localStorage.removeItem("auth_user");
    });

    await page.goto("/login");
    await page.getByLabel(/email/i).fill("test@example.com");
    await page.getByRole("button", { name: /sign in with passkey/i }).click();

    await expect(page).not.toHaveURL(/\/login$/);
  });
});
