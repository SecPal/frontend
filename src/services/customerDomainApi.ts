// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { apiConfig } from "../config";
import type {
  CreateCustomerEstablishmentRequest,
  CustomerEstablishment,
  CustomerLookup,
  EstablishmentLookup,
  UpdateCustomerEstablishmentRequest,
} from "@/types/api/customers";
import type { PaginatedResponse } from "@/types/customers";
import { apiFetch } from "./csrf";

const LOOKUP_KEYS = new Set(["id", "name"]);
const NEUTRAL_DUPLICATE_MESSAGE = "A matching record already exists.";

export class DuplicateResourceError extends Error {
  constructor() {
    super(NEUTRAL_DUPLICATE_MESSAGE);
    this.name = "DuplicateResourceError";
  }
}

function parseLookup(
  value: unknown,
  resource: "establishment" | "customer"
): EstablishmentLookup {
  const errorMessage = `Invalid ${resource} lookup response`;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(errorMessage);
  }
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).some((key) => !LOOKUP_KEYS.has(key)) ||
    typeof record.id !== "string" ||
    typeof record.name !== "string"
  ) {
    throw new Error(errorMessage);
  }
  return { id: record.id, name: record.name };
}

async function parseError(
  response: Response,
  fallback: string
): Promise<Error> {
  const payload = (await response.json().catch(() => null)) as {
    code?: unknown;
    message?: unknown;
    errors?: Record<string, string[]>;
  } | null;
  if (response.status === 409 || payload?.code === "DUPLICATE_RESOURCE") {
    return new DuplicateResourceError();
  }
  if (payload?.errors) {
    const details = Object.entries(payload.errors)
      .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
      .join("\n");
    if (details) return new Error(details);
  }
  return new Error(
    typeof payload?.message === "string" ? payload.message : fallback
  );
}

export async function listEstablishmentLookups(
  legalEntityId: string
): Promise<EstablishmentLookup[]> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/lookups/legal-entities/${encodeURIComponent(legalEntityId)}/establishments`
  );
  if (!response.ok)
    throw await parseError(response, "Failed to list establishments");
  const payload = (await response.json()) as unknown;
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    !Array.isArray(payload.data)
  ) {
    throw new Error("Invalid establishment lookup response");
  }
  return payload.data.map((value) => parseLookup(value, "establishment"));
}

export async function listCustomerLookups(
  establishmentId: string
): Promise<CustomerLookup[]> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/lookups/establishments/${encodeURIComponent(establishmentId)}/customers`
  );
  if (!response.ok)
    throw await parseError(response, "Failed to list customers");
  const payload = (await response.json()) as unknown;
  if (
    typeof payload !== "object" ||
    payload === null ||
    !("data" in payload) ||
    !Array.isArray(payload.data)
  ) {
    throw new Error("Invalid customer lookup response");
  }
  return payload.data.map((value) => parseLookup(value, "customer"));
}

export interface CustomerEstablishmentFilters {
  customer_id?: string;
  establishment_id?: string;
  page?: number;
  per_page?: number;
}

export async function listCustomerEstablishments(
  filters: CustomerEstablishmentFilters = {}
): Promise<PaginatedResponse<CustomerEstablishment>> {
  const params = new URLSearchParams();
  if (filters.customer_id) params.set("customer_id", filters.customer_id);
  if (filters.establishment_id)
    params.set("establishment_id", filters.establishment_id);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.per_page) params.set("per_page", String(filters.per_page));
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/customer-establishments?${params.toString()}`
  );
  if (!response.ok)
    throw await parseError(response, "Failed to list customer establishments");
  return (await response.json()) as PaginatedResponse<CustomerEstablishment>;
}

export async function createCustomerEstablishment(
  request: CreateCustomerEstablishmentRequest
): Promise<CustomerEstablishment> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/customer-establishments`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok)
    throw await parseError(response, "Failed to create customer establishment");
  const payload = (await response.json()) as { data?: CustomerEstablishment };
  if (!payload.data)
    throw new Error("Failed to parse customer establishment response");
  return payload.data;
}

export async function updateCustomerEstablishment(
  id: string,
  request: UpdateCustomerEstablishmentRequest
): Promise<CustomerEstablishment> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/customer-establishments/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok)
    throw await parseError(response, "Failed to update customer establishment");
  const payload = (await response.json()) as { data?: CustomerEstablishment };
  if (!payload.data)
    throw new Error("Failed to parse customer establishment response");
  return payload.data;
}

export async function deleteCustomerEstablishment(id: string): Promise<void> {
  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/customer-establishments/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
  if (!response.ok)
    throw await parseError(response, "Failed to delete customer establishment");
}
