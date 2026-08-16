// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

export function hasExactOrigin(
  requestUrl: string,
  expectedOrigin: string
): boolean {
  try {
    return new URL(requestUrl).origin === expectedOrigin;
  } catch {
    return false;
  }
}
