// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

export interface SmokeResponseRecord {
  url: string;
  status: number;
}

export const EXPECTED_AUTH_BOOTSTRAP_401_CONSOLE_ERROR =
  "Failed to load resource: the server responded with a status of 401 (Unauthorized)";

function isExpectedAuthBootstrap401(response: SmokeResponseRecord): boolean {
  return /\/v1\/me(\?|$)/.test(response.url) && response.status === 401;
}

export function filterExpectedSmokeConsoleErrors(
  jsErrors: string[],
  responses: SmokeResponseRecord[]
): string[] {
  let remainingExpectedAuthBootstrapErrors = responses.filter(
    isExpectedAuthBootstrap401
  ).length;

  return jsErrors.filter((error) => {
    if (
      remainingExpectedAuthBootstrapErrors > 0 &&
      error.includes(EXPECTED_AUTH_BOOTSTRAP_401_CONSOLE_ERROR)
    ) {
      remainingExpectedAuthBootstrapErrors -= 1;
      return false;
    }

    return true;
  });
}
