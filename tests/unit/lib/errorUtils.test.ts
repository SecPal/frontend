// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect } from "vitest";
import { msg } from "@lingui/core/macro";
import { getLocalizedErrorMessage } from "../../../src/lib/errorUtils";
import { ApiError } from "../../../src/services/ApiError";

/** Minimal translate stub that returns the message string. */
function t(descriptor: { id: string; message?: string }): string {
  return descriptor.message ?? descriptor.id;
}

const fallback = msg`Something went wrong.`;

describe("getLocalizedErrorMessage", () => {
  it("returns the authentication message for 401", () => {
    const error = new ApiError("Unauthorized", 401);
    const result = getLocalizedErrorMessage(error, t, { fallback });
    expect(result).toContain("session");
  });

  it("returns the authorization message for 403", () => {
    const error = new ApiError("Forbidden", 403);
    const result = getLocalizedErrorMessage(error, t, { fallback });
    expect(result).toContain("permission");
  });

  it("returns custom authorization message for 403 when provided", () => {
    const error = new ApiError("Forbidden", 403);
    const result = getLocalizedErrorMessage(error, t, {
      fallback,
      authorization: msg`Access denied.`,
    });
    expect(result).toBe("Access denied.");
  });

  it("returns the notFound fallback for 404 when notFound option is absent", () => {
    const error = new ApiError("Not found", 404);
    const result = getLocalizedErrorMessage(error, t, { fallback });
    expect(result).toBe("Something went wrong.");
  });

  it("returns custom notFound message for 404 when provided", () => {
    const error = new ApiError("Not found", 404);
    const result = getLocalizedErrorMessage(error, t, {
      fallback,
      notFound: msg`The resource was not found.`,
    });
    expect(result).toBe("The resource was not found.");
  });

  it("returns the conflict message for 409", () => {
    const error = new ApiError("Conflict", 409);
    const result = getLocalizedErrorMessage(error, t, { fallback });
    expect(result).toContain("data changed");
  });

  it("returns custom conflict message for 409 when provided", () => {
    const error = new ApiError("Conflict", 409);
    const result = getLocalizedErrorMessage(error, t, {
      fallback,
      conflict: msg`Please reload and try again.`,
    });
    expect(result).toBe("Please reload and try again.");
  });

  it("returns the validation message for 422", () => {
    const error = new ApiError("Unprocessable", 422);
    const result = getLocalizedErrorMessage(error, t, { fallback });
    expect(result).toContain("highlighted fields");
  });

  it("returns the rate limit message for 429", () => {
    const error = new ApiError("Too many requests", 429);
    const result = getLocalizedErrorMessage(error, t, { fallback });
    expect(result).toContain("Too many requests");
  });

  it("returns custom rate limit message for 429 when provided", () => {
    const error = new ApiError("Too many requests", 429);
    const result = getLocalizedErrorMessage(error, t, {
      fallback,
      rateLimit: msg`Slow down.`,
    });
    expect(result).toBe("Slow down.");
  });

  it("returns the server message for 500", () => {
    const error = new ApiError("Internal server error", 500);
    const result = getLocalizedErrorMessage(error, t, { fallback });
    expect(result).toContain("server error");
  });

  it("returns the fallback for unknown errors", () => {
    const error = new Error("Unknown");
    const result = getLocalizedErrorMessage(error, t, { fallback });
    expect(result).toBe("Something went wrong.");
  });
});
