// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";

import { redactCurrentPassword } from "../e2e/passkey-payload-redaction";

describe("passkey E2E payload redaction", () => {
  it("redacts current passwords without mutating the captured request", () => {
    const payload = {
      current_password: "correct-password",
      credential: { id: "credential-id" },
    };

    expect(redactCurrentPassword(payload)).toEqual({
      current_password: "[REDACTED]",
      credential: { id: "credential-id" },
    });
    expect(payload.current_password).toBe("correct-password");
  });

  it("preserves payloads without a current password", () => {
    const payload = { credential: { id: "credential-id" } };

    expect(redactCurrentPassword(payload)).toBe(payload);
  });
});
