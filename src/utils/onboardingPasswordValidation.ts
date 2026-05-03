// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

export type OnboardingPasswordIssue =
  | "too_short"
  | "mixed_case"
  | "number"
  | "symbol";

/**
 * Client-side checks aligned with backend
 * `Password::min(12)->mixedCase()->numbers()->symbols()->uncompromised()`.
 * Breach status (`uncompromised`) is enforced only server-side.
 */
export function getOnboardingPasswordIssue(
  password: string
): OnboardingPasswordIssue | null {
  if (password.length < 12) return "too_short";
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password)) return "mixed_case";
  if (!/[0-9]/.test(password)) return "number";
  if (!/[^A-Za-z0-9]/.test(password)) return "symbol";
  return null;
}
