// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  completeOnboarding,
  createOnboardingSubmission,
  fetchOnboardingSteps,
  fetchOnboardingTemplate,
  fetchOnboardingSubmissions,
  fetchOnboardingTemplates,
  validateOnboardingToken,
} from "../../../src/services/onboardingApi";
import { apiFetch } from "../../../src/services/csrf";

vi.mock("../../../src/services/csrf", async () => {
  const actual = await vi.importActual<
    typeof import("../../../src/services/csrf")
  >("../../../src/services/csrf");

  return {
    ...actual,
    apiFetch: vi.fn(),
  };
});

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
      body !== null
        ? Promise.resolve(body)
        : Promise.reject(new SyntaxError("invalid json")),
  } as unknown as Response;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateOnboardingToken", () => {
  it("throws OnboardingApiError with retryAfterSeconds when 429 includes Retry-After", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        makeFetchResponse(
          429,
          { message: "Too many attempts" },
          {
            "retry-after": "45",
          }
        )
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
      vi
        .fn()
        .mockResolvedValue(makeFetchResponse(404, { message: "Not found" }))
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
        makeFetchResponse(
          429,
          { message: "Rate limited" },
          {
            "retry-after": "not-a-number",
          }
        )
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
      vi.fn().mockResolvedValue(makeFetchResponse(503, null, {}))
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
  it("posts the documented JSON payload to the onboarding completion endpoint", async () => {
    const successfulCsrf = makeFetchResponse(204, {});
    const successfulCompletion = makeFetchResponse(200, {
      message: "Onboarding completed successfully",
      data: {
        user: {
          id: 1,
          email: "user@secpal.dev",
          name: "User Example",
        },
        employee: {
          id: "550e8400-e29b-41d4-a716-446655440000",
          first_name: "User",
          last_name: "Example",
          status: "pre_contract",
        },
      },
    });

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(successfulCsrf)
      .mockResolvedValueOnce(successfulCompletion);

    vi.stubGlobal("fetch", fetchMock);

    await expect(
      completeOnboarding({
        token: "tok",
        email: "user@secpal.dev",
        first_name: "User",
        last_name: "Example",
        password: "secret123",
      })
    ).resolves.toMatchObject({
      data: {
        user: {
          id: 1,
          email: "user@secpal.dev",
        },
      },
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("/v1/onboarding/complete"),
      expect.objectContaining({
        method: "POST",
        credentials: "include",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({
          token: "tok",
          email: "user@secpal.dev",
          first_name: "User",
          last_name: "Example",
          password: "secret123",
        }),
      })
    );
  });

  it("throws OnboardingApiError with retryAfterSeconds on 429 with Retry-After", async () => {
    const successfulCsrf = makeFetchResponse(200, {});
    const rateLimitedComplete = makeFetchResponse(
      429,
      { message: "Too many onboarding attempts" },
      { "retry-after": "120" }
    );

    vi.stubGlobal(
      "fetch",
      vi
        .fn()
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
      vi
        .fn()
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

describe("fetchOnboardingSteps", () => {
  it("sorts templates, merges existing submissions, and marks submitted steps complete", async () => {
    vi.mocked(apiFetch)
      .mockResolvedValueOnce(
        makeFetchResponse(200, {
          data: [
            {
              id: "template-2",
              name: "Tax Details",
              title: null,
              description: null,
              form_schema: {},
              sort_order: 20,
              step_number: null,
              is_required: true,
              is_system_template: true,
              can_be_deleted: false,
              can_be_edited: false,
            },
            {
              id: "template-1",
              name: "Personal Information",
              title: "Personal Information",
              description: "Describe yourself",
              form_schema: {},
              sort_order: 10,
              step_number: 3,
              is_required: true,
              is_system_template: true,
              can_be_deleted: false,
              can_be_edited: false,
            },
          ],
        })
      )
      .mockResolvedValueOnce(
        makeFetchResponse(200, {
          data: [
            {
              id: "submission-1",
              employee_id: "employee-1",
              form_template_id: "template-1",
              form_data: { legal_name: "Jane Doe" },
              status: "submitted",
              created_at: "2026-04-05T10:00:00Z",
              updated_at: "2026-04-05T10:00:00Z",
            },
          ],
        })
      );

    await expect(fetchOnboardingSteps()).resolves.toEqual([
      {
        step_number: 1,
        title: "Personal Information",
        description: "Describe yourself",
        template_id: "template-1",
        is_completed: true,
        submission: {
          id: "submission-1",
          employee_id: "employee-1",
          form_template_id: "template-1",
          form_data: { legal_name: "Jane Doe" },
          status: "submitted",
          created_at: "2026-04-05T10:00:00Z",
          updated_at: "2026-04-05T10:00:00Z",
        },
      },
      {
        step_number: 2,
        title: "Tax Details",
        description: undefined,
        template_id: "template-2",
        is_completed: false,
        submission: null,
      },
    ]);
  });
});

describe("fetchOnboardingTemplate", () => {
  it("normalizes missing title and step_number from the template payload", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(200, {
        data: {
          id: "template-3",
          name: "Emergency Contacts",
          title: null,
          description: null,
          form_schema: {},
          sort_order: 30,
          step_number: null,
          is_required: true,
          is_system_template: true,
          can_be_deleted: false,
          can_be_edited: false,
        },
      })
    );

    await expect(fetchOnboardingTemplate("template-3")).resolves.toEqual(
      expect.objectContaining({
        id: "template-3",
        title: "Emergency Contacts",
        step_number: 30,
      })
    );
  });
});

describe("fetchOnboardingTemplates", () => {
  it("throws a backend error message when the templates request fails", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(500, { message: "Templates unavailable" })
    );

    await expect(fetchOnboardingTemplates()).rejects.toThrow(
      "Templates unavailable"
    );
  });

  it("falls back to the HTTP status text when the templates error body is invalid JSON", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeFetchResponse(503, null));

    await expect(fetchOnboardingTemplates()).rejects.toThrow("HTTP 503");
  });

  it("throws when the templates payload does not contain an array", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(200, { data: { invalid: true } })
    );

    await expect(fetchOnboardingTemplates()).rejects.toThrow(
      "Failed to parse onboarding templates response"
    );
  });
});

describe("fetchOnboardingSubmissions", () => {
  it("throws a backend error message when the submissions request fails", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(500, { message: "Submissions unavailable" })
    );

    await expect(fetchOnboardingSubmissions()).rejects.toThrow(
      "Submissions unavailable"
    );
  });

  it("falls back to the HTTP status text when the submissions error body is invalid JSON", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(makeFetchResponse(502, null));

    await expect(fetchOnboardingSubmissions()).rejects.toThrow("HTTP 502");
  });

  it("throws when the submissions payload does not contain an array", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(200, { data: { invalid: true } })
    );

    await expect(fetchOnboardingSubmissions()).rejects.toThrow(
      "Failed to parse onboarding submissions response"
    );
  });
});

describe("createOnboardingSubmission", () => {
  it("accepts the legacy template_id field and sends form_template_id to the runtime API", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(201, {
        data: {
          id: "submission-2",
          employee_id: "employee-1",
          form_template_id: "template-9",
          form_data: { tax_id: "DE123" },
          status: "draft",
          created_at: "2026-04-05T10:00:00Z",
          updated_at: "2026-04-05T10:00:00Z",
        },
      })
    );

    await expect(
      createOnboardingSubmission({
        template_id: "template-9",
        form_data: { tax_id: "DE123" },
        status: "draft",
      } as Parameters<typeof createOnboardingSubmission>[0])
    ).resolves.toEqual(
      expect.objectContaining({
        id: "submission-2",
        form_template_id: "template-9",
      })
    );

    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/onboarding/submissions"),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          form_template_id: "template-9",
          form_data: { tax_id: "DE123" },
          status: "draft",
        }),
      })
    );
  });

  it("fails fast when no onboarding form template identifier is provided", async () => {
    await expect(
      createOnboardingSubmission({
        form_template_id: "",
        form_data: {},
        status: "draft",
      })
    ).rejects.toThrow("Missing onboarding form template identifier");
  });
});
