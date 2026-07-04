// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

const TRANSIENT_MODULE_LOAD_PATTERNS = [
  "failed to fetch dynamically imported module",
  "error loading dynamically imported module",
  "failed to fetch chunk",
  "loading chunk",
  "importing a module script failed",
  "module script failed",
  "chunkloaderror",
] as const;

export class RecoverableLazyModuleError extends Error {
  readonly code = "RECOVERABLE_LAZY_MODULE_ERROR";

  constructor(message: string, options?: { cause?: unknown }) {
    super(message);
    this.name = "RecoverableLazyModuleError";

    if (options && "cause" in options) {
      Object.defineProperty(this, "cause", {
        configurable: true,
        enumerable: false,
        value: options.cause,
        writable: true,
      });
    }
  }
}

export function isTransientModuleLoadError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalizedMessage = error.message.toLowerCase();
  const normalizedName = error.name.toLowerCase();

  return TRANSIENT_MODULE_LOAD_PATTERNS.some(
    (pattern) =>
      normalizedMessage.includes(pattern) || normalizedName.includes(pattern)
  );
}

export function createRecoverableLazyModuleError(
  message: string,
  cause: unknown
): RecoverableLazyModuleError {
  if (cause instanceof RecoverableLazyModuleError) {
    return cause;
  }

  return new RecoverableLazyModuleError(message, { cause });
}

export function isRecoverableLazyModuleError(
  error: unknown
): error is RecoverableLazyModuleError {
  return (
    error instanceof RecoverableLazyModuleError ||
    (typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "RECOVERABLE_LAZY_MODULE_ERROR")
  );
}
