// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { expect, test, type BrowserContext } from "@playwright/test";
import { isRemoteE2ETarget } from "./auth-helpers";

const MOCK_XSRF_TOKEN = "test-xsrf-token";

const validOnboardingEmail = "john.doe@secpal.dev";
const validOnboardingToken = "test-token-12345";

const onboardingTemplate = {
  id: "template-1",
  name: "Personal Details",
  title: "Personal Details",
  description: "Confirm your personal details before starting onboarding.",
  form_schema: {},
  is_required: true,
  is_system_template: true,
  sort_order: 1,
  can_be_deleted: false,
  can_be_edited: false,
};

function passwordInput(page: import("@playwright/test").Page) {
  return page.locator('input[name="password"]');
}

function passwordConfirmationInput(page: import("@playwright/test").Page) {
  return page.locator('input[name="password_confirmation"]');
}

async function installRemoteOnboardingFetchMocks(
  context: BrowserContext,
  responseDelayMs: number,
  mockDomain: string
): Promise<void> {
  await context.addCookies([
    {
      name: "XSRF-TOKEN",
      value: MOCK_XSRF_TOKEN,
      domain: mockDomain,
      path: "/",
      sameSite: "Lax",
      secure: true,
      httpOnly: false,
    },
  ]);

  await context.addInitScript(
    ({ xsrfToken, validToken, validEmail, template, delayMs }) => {
      const originalFetch = window.fetch.bind(window);

      const jsonResponse = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), {
          status,
          headers: {
            "Content-Type": "application/json",
          },
        });

      const emptyResponse = (status = 204) =>
        new Response(null, {
          status,
        });

      const resolveUrl = (input: RequestInfo | URL) => {
        if (typeof input === "string") {
          return new URL(input, window.location.origin);
        }

        if (input instanceof URL) {
          return input;
        }

        return new URL(input.url, window.location.origin);
      };

      const readRequestBody = async (
        input: RequestInfo | URL,
        init?: RequestInit
      ) => {
        const directBody = init?.body;

        if (typeof directBody === "string") {
          return directBody;
        }

        if (input instanceof Request) {
          return input.clone().text();
        }

        return "";
      };

      document.cookie = `XSRF-TOKEN=${encodeURIComponent(xsrfToken)}; path=/; SameSite=Lax`;

      window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = resolveUrl(input);
        const pathname = url.pathname;

        if (pathname === "/sanctum/csrf-cookie") {
          document.cookie = `XSRF-TOKEN=${encodeURIComponent(xsrfToken)}; path=/; SameSite=Lax`;
          return emptyResponse();
        }

        if (pathname === "/v1/me") {
          return jsonResponse({ message: "Unauthenticated." }, 401);
        }

        if (pathname === "/v1/onboarding/validate-token") {
          const token = url.searchParams.get("token");
          const email = url.searchParams.get("email");

          if (token === validToken && email === validEmail) {
            return jsonResponse({
              data: {
                first_name: "John",
                last_name: "Doe",
                email: validEmail,
              },
            });
          }

          return jsonResponse(
            {
              message: "Invalid or expired onboarding link.",
            },
            401
          );
        }

        if (pathname === "/v1/onboarding/complete") {
          const requestBodyText = await readRequestBody(input, init);
          const requestBody = requestBodyText
            ? (JSON.parse(requestBodyText) as Record<string, unknown>)
            : {};

          if (
            requestBody.token !== validToken ||
            requestBody.email !== validEmail
          ) {
            return jsonResponse(
              {
                message: "Invalid or expired onboarding link.",
                errors: {
                  token: ["Invalid or expired onboarding link."],
                },
              },
              422
            );
          }

          await new Promise((resolve) => window.setTimeout(resolve, delayMs));

          return jsonResponse({
            message: "Onboarding completed successfully.",
            data: {
              user: {
                id: "user-1",
                email: validEmail,
                email_verified: true,
                name: "John Doe",
              },
              employee: {
                id: "employee-1",
                first_name: "John",
                last_name: "Doe",
                status: "pre_contract",
              },
            },
          });
        }

        if (pathname === "/v1/onboarding/templates") {
          return jsonResponse({
            data: [template],
          });
        }

        if (/^\/v1\/onboarding\/templates\/.+/.test(pathname)) {
          return jsonResponse({
            data: template,
          });
        }

        if (pathname === "/v1/onboarding/submissions") {
          const method =
            init?.method ?? (input instanceof Request ? input.method : "GET");

          if (method === "GET") {
            return jsonResponse({
              data: [],
            });
          }

          return jsonResponse(
            {
              data: {
                id: "submission-1",
                employee_id: "employee-1",
                form_template_id: template.id,
                form_data: {},
                status: "draft",
                created_at: "2026-04-20T00:00:00Z",
                updated_at: "2026-04-20T00:00:00Z",
              },
            },
            201
          );
        }

        return originalFetch(input, init);
      };
    },
    {
      xsrfToken: MOCK_XSRF_TOKEN,
      validToken: validOnboardingToken,
      validEmail: validOnboardingEmail,
      template: onboardingTemplate,
      delayMs: responseDelayMs,
    }
  );
}

async function installMockOnboardingRoutes(
  context: BrowserContext,
  responseDelayMs = 350
): Promise<void> {
  const baseUrl = process.env.PLAYWRIGHT_BASE_URL ?? "";
  const isHttps = isRemoteE2ETarget(baseUrl);
  const mockDomain = isHttps ? new URL(baseUrl).hostname : "localhost";

  // Live app.secpal.dev can still ship a broken absolute API origin that the
  // browser blocks before Playwright network routing sees the request. For the
  // deterministic onboarding contract spec we therefore mock the public fetches
  // inside the page on remote targets, while keeping route-based mocks locally.
  if (isHttps) {
    await installRemoteOnboardingFetchMocks(
      context,
      responseDelayMs,
      mockDomain
    );
    return;
  }

  await context.route("**/sanctum/csrf-cookie", async (route) => {
    await context.addCookies([
      {
        name: "XSRF-TOKEN",
        value: MOCK_XSRF_TOKEN,
        domain: mockDomain,
        path: "/",
        sameSite: "Lax",
        secure: isHttps,
        httpOnly: false,
      },
    ]);
    await route.fulfill({
      status: 204,
      headers: {
        "set-cookie": `XSRF-TOKEN=${MOCK_XSRF_TOKEN}; Path=/; SameSite=Lax${isHttps ? "; Secure" : ""
          }`,
      },
      body: "",
    });
  });

  await context.route("**/v1/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ message: "Unauthenticated." }),
    });
  });

  await context.route("**/v1/onboarding/validate-token**", async (route) => {
    const url = new URL(route.request().url());
    const token = url.searchParams.get("token");
    const email = url.searchParams.get("email");

    if (token === validOnboardingToken && email === validOnboardingEmail) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            first_name: "John",
            last_name: "Doe",
            email: validOnboardingEmail,
          },
        }),
      });
      return;
    }

    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Invalid or expired onboarding link.",
      }),
    });
  });

  await context.route("**/v1/onboarding/complete", async (route) => {
    const body =
      (route.request().postDataJSON() as Record<string, unknown>) ?? {};

    if (
      body.token !== validOnboardingToken ||
      body.email !== validOnboardingEmail
    ) {
      await route.fulfill({
        status: 422,
        contentType: "application/json",
        body: JSON.stringify({
          message: "Invalid or expired onboarding link.",
          errors: {
            token: ["Invalid or expired onboarding link."],
          },
        }),
      });
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, responseDelayMs));

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Onboarding completed successfully.",
        data: {
          user: {
            id: "user-1",
            email: validOnboardingEmail,
            email_verified: true,
            name: "John Doe",
          },
          employee: {
            id: "employee-1",
            first_name: "John",
            last_name: "Doe",
            status: "pre_contract",
          },
        },
      }),
    });
  });

  await context.route("**/v1/onboarding/templates", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: [onboardingTemplate],
      }),
    });
  });

  await context.route("**/v1/onboarding/templates/*", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        data: onboardingTemplate,
      }),
    });
  });

  await context.route("**/v1/onboarding/submissions", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: [],
        }),
      });
      return;
    }

    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({
        data: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: onboardingTemplate.id,
          form_data: {},
          status: "draft",
          created_at: "2026-04-20T00:00:00Z",
          updated_at: "2026-04-20T00:00:00Z",
        },
      }),
    });
  });
}

test.describe("Onboarding Complete Flow", () => {
  test.beforeEach(async ({ context }) => {
    await installMockOnboardingRoutes(context);
  });

  test("completes onboarding with a deterministic valid magic link", async ({
    page,
  }) => {
    await page.goto(
      `/onboarding/complete?token=${validOnboardingToken}&email=${validOnboardingEmail}`
    );

    await expect(
      page.getByRole("heading", { name: /Welcome to SecPal!/i })
    ).toBeVisible();
    await expect(page.getByLabel(/First Names \(all\)/i)).toHaveValue("John");
    await expect(page.getByLabel(/Last Name/i)).toHaveValue("Doe");

    await passwordInput(page).fill("SecurePass123!");
    await passwordConfirmationInput(page).fill("SecurePass123!");
    await page.getByRole("button", { name: /Complete Account Setup/i }).click();

    await expect(
      page.getByRole("button", { name: /Completing Setup/i })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(
      page.getByRole("heading", { name: /Welcome to SecPal Onboarding/i })
    ).toBeVisible();
  });

  test("shows the invalid link state for an invalid token", async ({
    page,
  }) => {
    await page.goto("/onboarding/complete?token=invalid&email=test@secpal.dev");

    await expect(
      page.getByRole("heading", { name: /Invalid Link/i })
    ).toBeVisible();
    await expect(
      page.getByText(/Invalid or expired onboarding link/i)
    ).toBeVisible();
  });

  test("shows the invalid link state for a missing token", async ({ page }) => {
    await page.goto("/onboarding/complete");

    await expect(
      page.getByRole("heading", { name: /Invalid Link/i })
    ).toBeVisible();
    await expect(
      page.getByText(
        /Missing token and email\. Please use the link from your email\./i
      )
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Go to Login/i })
    ).toBeVisible();
  });

  test("validates password mismatch before submitting", async ({ page }) => {
    await page.goto(
      `/onboarding/complete?token=${validOnboardingToken}&email=${validOnboardingEmail}`
    );

    await passwordInput(page).fill("password1");
    await passwordConfirmationInput(page).fill("password2");
    await page.getByRole("button", { name: /Complete Account Setup/i }).click();

    await expect(page.getByText(/Passwords do not match/i)).toBeVisible();
  });

  test("validates minimum password length before submitting", async ({
    page,
  }) => {
    await page.goto(
      `/onboarding/complete?token=${validOnboardingToken}&email=${validOnboardingEmail}`
    );

    await passwordInput(page).fill("short");
    await passwordConfirmationInput(page).fill("short");
    await page.getByRole("button", { name: /Complete Account Setup/i }).click();

    await expect(
      page.getByText(/Password must be at least 8 characters/i)
    ).toBeVisible();
  });

  test("validates required onboarding fields with the current prefills", async ({
    page,
  }) => {
    await page.goto(
      `/onboarding/complete?token=${validOnboardingToken}&email=${validOnboardingEmail}`
    );

    await page.getByLabel(/First Names \(all\)/i).fill("");
    await page.getByLabel(/Last Name/i).fill("");
    await page.getByRole("button", { name: /Complete Account Setup/i }).click();

    await expect(page.getByText(/First name is required/i)).toBeVisible();
    await expect(page.getByText(/Last name is required/i)).toBeVisible();
    await expect(page.getByText(/Password is required/i)).toBeVisible();
  });

  test("shows the loading state and disables inputs during submission", async ({
    page,
  }) => {
    await page.goto(
      `/onboarding/complete?token=${validOnboardingToken}&email=${validOnboardingEmail}`
    );

    await passwordInput(page).fill("SecurePass123!");
    await passwordConfirmationInput(page).fill("SecurePass123!");
    await page.getByRole("button", { name: /Complete Account Setup/i }).click();

    await expect(
      page.getByRole("button", { name: /Completing Setup/i })
    ).toBeVisible();
    await expect(page.getByLabel(/First Names \(all\)/i)).toBeDisabled();
    await expect(page.getByLabel(/Last Name/i)).toBeDisabled();
    await expect(passwordInput(page)).toBeDisabled();

    await expect(page).toHaveURL(/\/onboarding$/);
  });
});
