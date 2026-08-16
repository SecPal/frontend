// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

const REDACTED_VALUE = "[REDACTED]";

export function redactCurrentPassword(payload: unknown): unknown {
  if (
    typeof payload !== "object" ||
    payload === null ||
    Array.isArray(payload) ||
    !Object.hasOwn(payload, "current_password")
  ) {
    return payload;
  }

  return {
    ...payload,
    current_password: REDACTED_VALUE,
  };
}
