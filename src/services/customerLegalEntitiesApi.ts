// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { apiConfig } from "../config";
import type { CustomerLegalEntityLookup } from "../types/customers";
import { apiFetch } from "./csrf";

const LEGAL_ENTITY_LOOKUP_KEYS = new Set(["id", "name"]);

function parseCustomerLegalEntityLookup(
  value: unknown
): CustomerLegalEntityLookup {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Invalid legal entity lookup response");
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);

  if (
    keys.some((key) => !LEGAL_ENTITY_LOOKUP_KEYS.has(key)) ||
    typeof record.id !== "string" ||
    typeof record.name !== "string"
  ) {
    throw new Error("Invalid legal entity lookup response");
  }

  return {
    id: record.id,
    name: record.name,
  };
}

export async function listCustomerLegalEntities(): Promise<
  CustomerLegalEntityLookup[]
> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/customers/legal-entities`
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new Error(error.message || "Failed to list legal entities");
  }

  const data = (await response.json()) as { data?: unknown };
  if (!Array.isArray(data.data)) {
    throw new Error("Invalid legal entity lookup response");
  }

  return data.data.map(parseCustomerLegalEntityLookup);
}
