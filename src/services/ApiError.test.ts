// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { ApiError } from "./ApiError";

describe("ApiError", () => {
  it("stores validation errors and response when both are provided", () => {
    const response = new Response(
      JSON.stringify({ message: "Validation failed" }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      }
    );
    const errors = {
      email: ["The email field is required."],
      password: ["The password must be at least 12 characters."],
    };

    const error = new ApiError("Validation failed", 422, errors, response);

    expect(error.message).toBe("Validation failed");
    expect(error.name).toBe("ApiError");
    expect(error.status).toBe(422);
    expect(error.statusCode).toBe(422);
    expect(error.errors).toEqual(errors);
    expect(error.response).toBe(response);
    expect(error.isValidationError()).toBe(true);
    expect(error.isServerError()).toBe(false);
  });

  it("stores a response passed as the overloaded third argument", () => {
    const response = new Response("Not found", { status: 404 });

    const error = new ApiError("Employee not found", 404, response);

    expect(error.status).toBe(404);
    expect(error.statusCode).toBe(404);
    expect(error.errors).toBeUndefined();
    expect(error.response).toBe(response);
    expect(error.isNotFoundError()).toBe(true);
  });

  it("classifies authentication, authorization, and server errors", () => {
    const authenticationError = new ApiError("Unauthenticated", 401);
    const authorizationError = new ApiError("Forbidden", 403);
    const serverError = new ApiError("Server exploded", 503);

    expect(authenticationError.isAuthenticationError()).toBe(true);
    expect(authenticationError.isAuthorizationError()).toBe(false);

    expect(authorizationError.isAuthorizationError()).toBe(true);
    expect(authorizationError.isAuthenticationError()).toBe(false);

    expect(serverError.isServerError()).toBe(true);
    expect(serverError.isValidationError()).toBe(false);
  });
});
