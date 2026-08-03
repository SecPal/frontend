// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expectTypeOf, it } from "vitest";

import type {
  PasskeyRegistrationVerificationRequest,
  PasskeyTransport,
} from "./auth";
import type { components } from "./openapi.generated";

describe("authentication API types", () => {
  it("aliases passkey transports to the OpenAPI contract", () => {
    expectTypeOf<PasskeyTransport>().toEqualTypeOf<
      components["schemas"]["PasskeyTransport"]
    >();
  });

  it("aliases passkey registration verification to the OpenAPI contract", () => {
    expectTypeOf<PasskeyRegistrationVerificationRequest>().toEqualTypeOf<
      components["schemas"]["PasskeyRegistrationVerificationRequest"]
    >();
  });
});
