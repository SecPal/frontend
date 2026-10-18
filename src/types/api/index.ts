// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { components } from "./openapi.generated";

export * from "../customers";
export * from "./auth";
export * from "./bootstrap";
export * from "./employees";
export * from "./notifications";
export * from "./organizational";
export * from "./release";

export type AddressReferenceMeta =
  components["schemas"]["AddressReferenceMeta"];
export type AddressStreetSuggestion =
  components["schemas"]["AddressStreetSuggestion"];
export type AddressLocalitySuggestion =
  components["schemas"]["AddressLocalitySuggestion"];
export type AddressStreetSuggestionResponse =
  components["schemas"]["AddressStreetSuggestionResponse"];
export type AddressLocalitySuggestionResponse =
  components["schemas"]["AddressLocalitySuggestionResponse"];
