// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Get initials from a name string.
 * Returns up to 2 characters (first letter of first and last name).
 * Handles edge cases like empty strings or whitespace-only strings.
 *
 * @param name - The full name to extract initials from
 * @returns Up to 2 uppercase characters, or empty string for invalid input
 *
 * @example
 * getInitials("John Doe") // "JD"
 * getInitials("Alice") // "A"
 * getInitials("") // ""
 * getInitials("  ") // ""
 */
export function getInitials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed
    .split(" ")
    .filter((part) => part.length > 0)
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
