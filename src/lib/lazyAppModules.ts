// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import {
  createRecoverableLazyModuleError,
  isTransientModuleLoadError,
} from "./lazyModuleErrors";

export async function loadAuthenticatedAppModule() {
  try {
    return await import("../AuthenticatedApp");
  } catch (error) {
    if (isTransientModuleLoadError(error)) {
      throw createRecoverableLazyModuleError(
        "The protected app shell is temporarily unavailable on this device.",
        error
      );
    }

    throw error;
  }
}

export async function loadLoginMfaDialogModule() {
  try {
    return await import("../pages/LoginMfaDialog");
  } catch (error) {
    if (isTransientModuleLoadError(error)) {
      throw createRecoverableLazyModuleError(
        "The secure MFA prompt is temporarily unavailable on this device.",
        error
      );
    }

    throw error;
  }
}
