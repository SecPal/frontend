// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expectTypeOf, it } from "vitest";

import type {
  PasskeyCurrentPasswordStepUpRequest,
  PasskeyRegistrationVerificationRequest,
  PasskeyTransport,
} from "./auth";
import type { components } from "./openapi.generated";
import type {
  startPasskeyRegistrationChallenge,
  verifyPasskeyRegistrationChallenge,
} from "@/services/authAccountApi";

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

  it("aliases the passkey current-password step-up to the OpenAPI contract", () => {
    expectTypeOf<PasskeyCurrentPasswordStepUpRequest>().toEqualTypeOf<
      components["schemas"]["PasskeyCurrentPasswordStepUpRequest"]
    >();
  });

  it("keeps passkey enrollment client inputs aligned with generated requests", () => {
    expectTypeOf<
      Parameters<typeof startPasskeyRegistrationChallenge>[0]
    >().toEqualTypeOf<PasskeyCurrentPasswordStepUpRequest>();
    expectTypeOf<
      Parameters<typeof verifyPasskeyRegistrationChallenge>[1]
    >().toEqualTypeOf<PasskeyRegistrationVerificationRequest>();
  });
});
