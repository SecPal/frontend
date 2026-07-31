// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: CC0-1.0

/**
 * Suppress the Node.js stderr warning:
 *   "The 'NO_COLOR' env is ignored due to the 'FORCE_COLOR' env being set."
 *
 * Playwright injects `FORCE_COLOR=1` into every worker and web-server child.
 * Removing inherited color-disabling variables before those processes fork
 * preserves Playwright's behavior and prevents repeated warnings.
 */
export function scrubPlaywrightColorEnvironment(): void {
  for (const name of ["NO_COLOR", "NODE_DISABLE_COLORS"] as const) {
    if (process.env[name] !== undefined) {
      delete process.env[name];
    }
  }
}
