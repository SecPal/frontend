// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { beforeEach, describe, it, expect, vi } from "vitest";
import {
  approveOnboardingSubmission,
  completeOnboarding,
  createOnboardingSubmission,
  deleteOnboardingFile,
  fetchOnboardingSteps,
  fetchOnboardingTemplate,
  fetchOnboardingSubmissions,
  fetchOnboardingTemplates,
  rejectOnboardingSubmission,
  updateOnboardingSubmission,
  uploadOnboardingFile,
  validateOnboardingToken,
} from "../../../src/services/onboardingApi";
import { ApiError } from "../../../src/services/ApiError";
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

const INVALID_JSON_BODY = "{invalid-json";

function makeFetchResponse(
  status: number,
  body: object | null,
  headers: Record<string, string> = {}
): Response {
  const isNullBodyStatus =
    status === 101 || status === 204 || status === 205 || status === 304;
  const responseBody = isNullBodyStatus
    ? null
    : body !== null
      ? JSON.stringify(body)
      : INVALID_JSON_BODY;
  return new Response(responseBody, {
    status,
    statusText: `HTTP ${status}`,
    headers: new Headers(headers),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("validateOnboardingToken", () => {
  it("resolves to the minimal { valid: true } payload on success (no personal data leaked)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(makeFetchResponse(200, { data: { valid: true } }))
    );

    await expect(
      validateOnboardingToken("tok", "user@secpal.dev")
    ).resolves.toEqual({ data: { valid: true } });
  });

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
        date_of_birth: "1990-01-01",
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
          date_of_birth: "1990-01-01",
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
        date_of_birth: "1990-01-01",
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
        date_of_birth: "1990-01-01",
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
  it("returns sorted onboarding steps with submission status", async () => {
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
        is_required: true,
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
        is_required: true,
        is_completed: false,
        submission: null,
      },
    ]);
  });
});

describe("fetchOnboardingTemplate", () => {
  it("uses template name as title fallback and sort_order as step_number fallback when null", async () => {
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

  it("preserves backend-provided tax identification schema rules", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(200, {
        data: {
          id: "template-tax",
          name: "Steueridentifikationsnummer",
          template_key: "tax_identification_number",
          title: "Steueridentifikationsnummer",
          description:
            "Optionale elfstellige Steueridentifikationsnummer (§ 39e EStG)",
          form_schema: {
            type: "object",
            description:
              "Optionale elfstellige Steueridentifikationsnummer (§ 39e EStG)",
            properties: {
              tax_id: {
                type: "string",
                title: "Steueridentifikationsnummer",
                pattern: "^\\d{11}$",
              },
              children_count: {
                type: "integer",
                title: "Anzahl Kinder",
                minimum: 0,
              },
            },
            required: [],
          },
          sort_order: 40,
          step_number: null,
          is_required: false,
          is_system_template: true,
          can_be_deleted: false,
          can_be_edited: false,
        },
      })
    );

    await expect(
      fetchOnboardingTemplate("template-tax")
    ).resolves.toMatchObject({
      id: "template-tax",
      is_required: false,
      description:
        "Optionale elfstellige Steueridentifikationsnummer (§ 39e EStG)",
      form_schema: {
        description:
          "Optionale elfstellige Steueridentifikationsnummer (§ 39e EStG)",
        properties: {
          tax_id: {
            title: "Steueridentifikationsnummer",
            pattern: "^\\d{11}$",
          },
          children_count: {
            type: "integer",
          },
        },
        required: [],
      },
    });
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
  it("requires form_template_id and sends it to the runtime API", async () => {
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
        form_template_id: "template-9",
        form_data: { tax_id: "DE123" },
        status: "draft",
      })
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

  it("rejects the legacy template_id alias when form_template_id is missing", async () => {
    const invalidPayload = {
      template_id: "template-9",
      form_data: { tax_id: "DE123" },
      status: "draft",
    };

    await expect(
      createOnboardingSubmission(
        invalidPayload as Parameters<typeof createOnboardingSubmission>[0]
      )
    ).rejects.toThrow("Missing onboarding form template identifier");

    expect(apiFetch).not.toHaveBeenCalled();
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

  it("throws ApiError with validation errors when the API returns 422", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(422, {
        message: "The form data is invalid.",
        errors: {
          "form_data.iban": ["The IBAN field is required."],
        },
      })
    );

    await expect(
      createOnboardingSubmission({
        form_template_id: "template-9",
        form_data: {},
        status: "submitted",
      })
    ).rejects.toSatisfy(
      (err) =>
        err instanceof ApiError &&
        err.status === 422 &&
        err.errors?.["form_data.iban"]?.[0] === "The IBAN field is required."
    );
  });

  it("throws ApiError using statusText when the API error body has no message", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(500, { errors: null })
    );

    await expect(
      createOnboardingSubmission({
        form_template_id: "template-9",
        form_data: {},
        status: "submitted",
      })
    ).rejects.toSatisfy((err) => err instanceof ApiError && err.status === 500);
  });
});

describe("updateOnboardingSubmission", () => {
  it("patches the submission and returns updated data", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(200, {
        data: {
          id: "submission-3",
          employee_id: "employee-1",
          form_template_id: "template-9",
          form_data: { iban: "DE89370400440532013000" },
          status: "draft",
          created_at: "2026-05-03T10:00:00Z",
          updated_at: "2026-05-03T11:00:00Z",
        },
      })
    );

    await expect(
      updateOnboardingSubmission("submission-3", {
        form_data: { iban: "DE89370400440532013000" },
        status: "draft",
      })
    ).resolves.toEqual(
      expect.objectContaining({
        id: "submission-3",
        status: "draft",
      })
    );

    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/onboarding/submissions/submission-3"),
      expect.objectContaining({ method: "PATCH" })
    );
  });

  it("throws ApiError with validation errors when update returns 422", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(422, {
        message: "Form data is required",
        errors: {
          form_data: ["Form data is required"],
        },
      })
    );

    await expect(
      updateOnboardingSubmission("submission-3", {
        form_data: {},
        status: "submitted",
      })
    ).rejects.toSatisfy(
      (err) =>
        err instanceof ApiError &&
        err.status === 422 &&
        err.errors?.["form_data"]?.[0] === "Form data is required"
    );
  });
});

describe("uploadOnboardingFile", () => {
  it("posts onboarding attachments as multipart form data to the submission files endpoint", async () => {
    const file = new File(["contract"], "contract.pdf", {
      type: "application/pdf",
    });

    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(201, {
        data: {
          id: "file-9",
          filename: "contract.pdf",
        },
      })
    );

    await expect(
      uploadOnboardingFile(
        "submission-9",
        file,
        "id_document",
        "identity_document"
      )
    ).resolves.toEqual({
      id: "file-9",
      filename: "contract.pdf",
    });

    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining("/v1/onboarding/submissions/submission-9/files"),
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      })
    );

    const requestBody = vi.mocked(apiFetch).mock.calls[0]?.[1]?.body;
    expect(requestBody).toBeInstanceOf(FormData);
    expect((requestBody as FormData).get("document_type")).toBe("id_document");
    expect((requestBody as FormData).get("document_subtype")).toBe(
      "identity_document"
    );
  });

  it("falls back to the backend message when onboarding attachment upload fails", async () => {
    const file = new File(["id"], "passport.png", { type: "image/png" });

    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(422, {
        message: "The file must be a file of type: pdf, jpg, jpeg, png.",
      })
    );

    await expect(
      uploadOnboardingFile("submission-9", file, "id_document")
    ).rejects.toThrow("The file must be a file of type: pdf, jpg, jpeg, png.");
  });
});

describe("deleteOnboardingFile", () => {
  it("calls the submission file delete endpoint", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      new Response(null, { status: 204 })
    );

    await expect(
      deleteOnboardingFile("submission-9", "file-123")
    ).resolves.toBeUndefined();

    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/v1/onboarding/submissions/submission-9/files/file-123"
      ),
      expect.objectContaining({
        method: "DELETE",
      })
    );
  });

  it("throws backend message when deletion fails", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(422, { message: "File cannot be deleted." })
    );

    await expect(
      deleteOnboardingFile("submission-9", "file-123")
    ).rejects.toThrow("File cannot be deleted.");
  });
});

describe("approveOnboardingSubmission", () => {
  it("posts the onboarding review approval action to the neutral runtime path", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(200, {
        data: {
          id: "submission-9",
          employee_id: "employee-1",
          form_template_id: "template-9",
          form_data: { legal_name: "Casey Example" },
          status: "approved",
          reviewed_by: "reviewer-1",
          reviewed_at: "2026-05-01T12:00:00Z",
          created_at: "2026-05-01T11:00:00Z",
          updated_at: "2026-05-01T12:00:00Z",
        },
      })
    );

    await expect(approveOnboardingSubmission("submission-9")).resolves.toEqual(
      expect.objectContaining({
        id: "submission-9",
        status: "approved",
      })
    );

    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/v1/onboarding-review/submissions/submission-9/approve"
      ),
      expect.objectContaining({ method: "POST" })
    );
  });
});

describe("rejectOnboardingSubmission", () => {
  it("posts the onboarding review rejection action to the neutral runtime path", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(
      makeFetchResponse(200, {
        data: {
          id: "submission-9",
          employee_id: "employee-1",
          form_template_id: "template-9",
          form_data: { legal_name: "Casey Example" },
          status: "rejected",
          review_notes: "Missing signature",
          reviewed_by: "reviewer-1",
          reviewed_at: "2026-05-01T12:00:00Z",
          created_at: "2026-05-01T11:00:00Z",
          updated_at: "2026-05-01T12:00:00Z",
        },
      })
    );

    await expect(
      rejectOnboardingSubmission("submission-9", "Missing signature")
    ).resolves.toEqual(
      expect.objectContaining({
        id: "submission-9",
        status: "rejected",
        review_notes: "Missing signature",
      })
    );

    expect(apiFetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/v1/onboarding-review/submissions/submission-9/reject"
      ),
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ reason: "Missing signature" }),
      })
    );
  });
});
