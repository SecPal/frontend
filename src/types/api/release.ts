// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/**
 * Public API release metadata types.
 *
 * Derived from the shared API contract and exposed through the central
 * `@/types/api` entry point like the other API response surfaces.
 */

export interface PublicApiReleaseMetadata {
  version: string;
  source_url: string;
}

export interface PublicApiReleaseResponse {
  data: PublicApiReleaseMetadata;
}
