// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

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

const fallbackAuthenticationChallenge = {
  data: {
    challenge_id: "550e8400-e29b-41d4-a716-446655440002",
    public_key: {
      challenge: "YmFyZm9v",
      rp_id: "app.secpal.dev",
      timeout: 60000,
      user_verification: "preferred",
      allow_credentials: [{ id: "Y3JlZGVudGlhbC1pZA", type: "public-key" }],
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

async function installPasskeyBrowserMocks(
  page: Page,
  options?: { failDiscoverableOnce?: boolean }
) {
  await page.addInitScript(
    ({ failDiscoverableOnce }) => {
      let assertionCalls = 0;

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
          get: async (options?: CredentialRequestOptions) => {
            const allowCredentials = options?.publicKey?.allowCredentials ?? [];

            assertionCalls += 1;

            if (
              failDiscoverableOnce &&
              assertionCalls === 1 &&
              allowCredentials.length === 0
            ) {
              throw new Error(
                "Resident credentials or empty allowCredentials lists are not supported"
              );
            }

            return {
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
            };
          },
        },
      });
    },
    { failDiscoverableOnce: options?.failDiscoverableOnce ?? false }
  );
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

  test("retries passkey sign-in with an email-scoped challenge when discoverable mode is unsupported", async ({
    page,
  }) => {
    await installPasskeyBrowserMocks(page, { failDiscoverableOnce: true });

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
      const rawBody = route.request().postData();
      const body = rawBody ? (JSON.parse(rawBody) as { email?: string }) : null;

      if (body?.email === "test@example.com") {
        await fulfillJson(route, fallbackAuthenticationChallenge, 201);
        return;
      }

      await fulfillJson(route, authenticationChallenge, 201);
    });
    await page.route(
      "**/v1/auth/passkeys/challenges/550e8400-e29b-41d4-a716-446655440002/verify",
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
  });

  test("keeps registration persistence and email-first login lookup in sync", async ({
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
      const body = rawBody ? (JSON.parse(rawBody) as { email?: string }) : null;

      if (body?.email === "test@example.com" && storedPasskeys.length > 0) {
        await fulfillJson(
          route,
          {
            data: {
              challenge_id: fallbackAuthenticationChallenge.data.challenge_id,
              public_key: {
                ...fallbackAuthenticationChallenge.data.public_key,
                allow_credentials: [
                  {
                    id: storedPasskeys[0]!.id,
                    type: "public-key",
                  },
                ],
              },
              mediation: fallbackAuthenticationChallenge.data.mediation,
              expires_at: fallbackAuthenticationChallenge.data.expires_at,
            },
          },
          201
        );
        return;
      }

      await fulfillJson(
        route,
        {
          message:
            "Passkey sign-in is not available for the provided email address.",
          errors: {
            email: [
              "Passkey sign-in is not available for the provided email address.",
            ],
          },
        },
        422
      );
    });
    await page.route(
      "**/v1/auth/passkeys/challenges/550e8400-e29b-41d4-a716-446655440002/verify",
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
