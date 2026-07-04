// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { msg, type MacroMessageDescriptor } from "@lingui/core/macro";
import type { ApiValidationErrors } from "../services/ApiError";
import { ApiError } from "../services/ApiError";
import { AuthApiError } from "../services/AuthApiError";

type TranslatableDescriptor = { id: string; message?: string };
type Translate = (descriptor: TranslatableDescriptor) => string;

interface OnboardingLikeError {
  response?: {
    status?: number;
    data?: {
      errors?: ApiValidationErrors;
    };
    retryAfterSeconds?: number;
  };
}

interface LocalizedErrorMessageOptions {
  fallback: MacroMessageDescriptor;
  authentication?: MacroMessageDescriptor;
  authorization?: MacroMessageDescriptor;
  validation?: MacroMessageDescriptor;
  rateLimit?: MacroMessageDescriptor;
  notFound?: MacroMessageDescriptor;
  conflict?: MacroMessageDescriptor;
  server?: MacroMessageDescriptor;
}

function translateMessage(
  translate: Translate,
  descriptor: MacroMessageDescriptor
): string {
  return translate(descriptor as TranslatableDescriptor);
}

function getErrorStatus(error: unknown): number | undefined {
  if (error instanceof ApiError) {
    return error.statusCode;
  }

  if (error instanceof AuthApiError) {
    return error.status;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as OnboardingLikeError).response?.status === "number"
  ) {
    return (error as OnboardingLikeError).response?.status;
  }

  return undefined;
}

export function getErrorRetryAfterSeconds(error: unknown): number | undefined {
  if (error instanceof AuthApiError) {
    return error.retryAfterSeconds;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as OnboardingLikeError).response?.retryAfterSeconds ===
      "number"
  ) {
    return (error as OnboardingLikeError).response?.retryAfterSeconds;
  }

  return undefined;
}

export function getErrorValidationErrors(
  error: unknown
): ApiValidationErrors | undefined {
  if (error instanceof ApiError) {
    return error.errors;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    (error as OnboardingLikeError).response?.data?.errors
  ) {
    return (error as OnboardingLikeError).response?.data?.errors;
  }

  return undefined;
}

export function getLocalizedErrorMessage(
  error: unknown,
  translate: Translate,
  options: LocalizedErrorMessageOptions
): string {
  const status = getErrorStatus(error);

  if (status === 401) {
    return translateMessage(
      translate,
      options.authentication ??
        msg`Your session has expired or your sign-in could not be verified. Please sign in again.`
    );
  }

  if (status === 403) {
    return translateMessage(
      translate,
      options.authorization ??
        msg`You do not have permission to perform this action.`
    );
  }

  if (status === 404) {
    return translateMessage(translate, options.notFound ?? options.fallback);
  }

  if (status === 409) {
    return translateMessage(
      translate,
      options.conflict ??
        msg`This action could not be completed because the data changed in the meantime. Please reload and try again.`
    );
  }

  if (status === 422) {
    return translateMessage(
      translate,
      options.validation ??
        msg`Please review the highlighted fields and try again.`
    );
  }

  if (status === 429) {
    return translateMessage(
      translate,
      options.rateLimit ?? msg`Too many requests. Please try again later.`
    );
  }

  if (status !== undefined && status >= 500) {
    return translateMessage(
      translate,
      options.server ??
        msg`A server error occurred. Please try again later or contact support if the problem persists.`
    );
  }

  return translateMessage(translate, options.fallback);
}
