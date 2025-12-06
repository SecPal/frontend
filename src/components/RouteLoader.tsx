// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * RouteLoader - Loading indicator for lazy-loaded routes
 *
 * Provides visual feedback while code chunks are being loaded.
 * Uses Tailwind classes for consistent styling.
 */
export function RouteLoader() {
  return (
    <div
      className="flex items-center justify-center min-h-screen"
      role="status"
      aria-live="polite"
    >
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      <span className="sr-only">Loading...</span>
    </div>
  );
}
