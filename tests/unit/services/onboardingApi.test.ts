// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi } from "vitest";
import {
  validateOnboardingToken,
  completeOnboarding,
} from "../../../src/services/onboardingApi";

function makeFetchResponse(
  status: number,
  body: object | null,
  headers: Record<string, string> = {}
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: `HTTP ${status}`,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
    },
    json: () =>
      body !== null ? Promise.resolve(body) : Promise.reject(new SyntaxError("invalid json")),
  } as unknown as Response;
}

describe("validateOnboardingToken", () => {
  it("throws OnboardingApiError with retryAfterSeconds when 429 includes Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeFetchResponse(429, { message: "Too many attempts" }, {
          "retry-after": "45",
        })
      )
    );

    await expect(
      validateOnboardingToken("tok", "user@secpal.dev")
    ).rejects.toMatchObject({
      response: {
        status: 429,
        retryAfterSeconds: 45,
        data: { message: "Too many attempts" },
      },
    });
  });

  it("throws OnboardingApiError without retryAfterSeconds when Retry-After header is absent", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeFetchResponse(404, { message: "Not found" })
      )
    );

    await expect(
      validateOnboardingToken("bad-token", "user@secpal.dev")
    ).rejects.toMatchObject({
      response: {
        status: 404,
        retryAfterSeconds: undefined,
        data: { message: "Not found" },
      },
    });
  });

  it("throws OnboardingApiError without retryAfterSeconds when Retry-After is not a number", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeFetchResponse(429, { message: "Rate limited" }, {
          "retry-after": "not-a-number",
        })
      )
    );

    await expect(
      validateOnboardingToken("tok", "user@secpal.dev")
    ).rejects.toMatchObject({
      response: {
        status: 429,
        retryAfterSeconds: undefined,
      },
    });
  });

  it("falls back to statusText when response body is not valid JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeFetchResponse(503, null, {})
      )
    );

    await expect(
      validateOnboardingToken("tok", "user@secpal.dev")
    ).rejects.toMatchObject({
      response: {
        status: 503,
        retryAfterSeconds: undefined,
        data: { message: "HTTP 503" },
      },
    });
  });
});

describe("completeOnboarding", () => {
  it("throws OnboardingApiError with retryAfterSeconds on 429 with Retry-After", async () => {
    const successfulCsrf = makeFetchResponse(200, {});
    const rateLimitedComplete = makeFetchResponse(
      429,
      { message: "Too many onboarding attempts" },
      { "retry-after": "120" }
    );

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(successfulCsrf)
        .mockResolvedValueOnce(rateLimitedComplete)
    );

    await expect(
      completeOnboarding({
        token: "tok",
        email: "user@secpal.dev",
        first_name: "John",
        last_name: "Doe",
        password: "secret123",
        password_confirmation: "secret123",
      })
    ).rejects.toMatchObject({
      response: {
        status: 429,
        retryAfterSeconds: 120,
        data: { message: "Too many onboarding attempts" },
      },
    });
  });

  it("throws OnboardingApiError with field errors on 422", async () => {
    const successfulCsrf = makeFetchResponse(200, {});
    const validationError = makeFetchResponse(422, {
      message: "Validation failed",
      errors: { first_name: ["The first name field is required."] },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn()
        .mockResolvedValueOnce(successfulCsrf)
        .mockResolvedValueOnce(validationError)
    );

    await expect(
      completeOnboarding({
        token: "tok",
        email: "user@secpal.dev",
        first_name: "",
        last_name: "Doe",
        password: "secret123",
        password_confirmation: "secret123",
      })
    ).rejects.toMatchObject({
      response: {
        status: 422,
        data: {
          errors: { first_name: ["The first name field is required."] },
        },
      },
    });
  });
});
