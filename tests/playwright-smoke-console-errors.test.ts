// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import {
  EXPECTED_AUTH_BOOTSTRAP_401_CONSOLE_ERROR,
  filterExpectedSmokeConsoleErrors,
} from "./e2e/smoke-console-errors";

describe("playwright smoke console error filtering", () => {
  it("drops the expected logged-out auth bootstrap 401 console error when /v1/me returned 401", () => {
    const filteredErrors = filterExpectedSmokeConsoleErrors(
      [EXPECTED_AUTH_BOOTSTRAP_401_CONSOLE_ERROR],
      [{ url: "https://api.secpal.dev/v1/me", status: 401 }]
    );

    expect(filteredErrors).toEqual([]);
  });

  it("keeps the same 401 console error when the matching auth bootstrap response was not observed", () => {
    const filteredErrors = filterExpectedSmokeConsoleErrors(
      [EXPECTED_AUTH_BOOTSTRAP_401_CONSOLE_ERROR],
      [{ url: "https://api.secpal.dev/v1/auth/login", status: 401 }]
    );

    expect(filteredErrors).toEqual([
      EXPECTED_AUTH_BOOTSTRAP_401_CONSOLE_ERROR,
    ]);
  });

  it("does not hide real CSP or loopback-origin failures", () => {
    const cspError =
      "Fetch API cannot load http://localhost:4173/v1/me. Refused to connect because it violates the document's Content Security Policy.";

    const filteredErrors = filterExpectedSmokeConsoleErrors(
      [EXPECTED_AUTH_BOOTSTRAP_401_CONSOLE_ERROR, cspError],
      [{ url: "https://api.secpal.dev/v1/me", status: 401 }]
    );

    expect(filteredErrors).toEqual([cspError]);
  });
});
