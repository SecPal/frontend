// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { ApiError } from "./ApiError";
import { apiFetch } from "./csrf";
import type {
  AddressStreetSuggestionResponse,
  AddressLocalitySuggestionResponse,
} from "@/types/api";
export type {
  AddressStreetSuggestion,
  AddressLocalitySuggestion,
} from "@/types/api";

export async function fetchAddressStreetSuggestions(params: {
  name?: string;
  postalCode?: string;
  locality?: string;
  limit?: number;
}): Promise<AddressStreetSuggestionResponse> {
  const searchParams = new URLSearchParams();

  if (params.name) {
    searchParams.set("name", params.name);
  }
  if (params.postalCode) {
    searchParams.set("postal_code", params.postalCode);
  }
  if (params.locality) {
    searchParams.set("locality", params.locality);
  }
  if (params.limit) {
    searchParams.set("limit", String(params.limit));
  }

  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/addresses/de/streets?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(
      error.message || "Failed to fetch address street suggestions",
      response.status
    );
  }

  return (await response.json()) as AddressStreetSuggestionResponse;
}

export async function fetchAddressLocalitySuggestions(params: {
  postalCode?: string;
  locality?: string;
  limit?: number;
}): Promise<AddressLocalitySuggestionResponse> {
  const searchParams = new URLSearchParams();

  if (params.postalCode) {
    searchParams.set("postal_code", params.postalCode);
  }
  if (params.locality) {
    searchParams.set("locality", params.locality);
  }
  if (params.limit) {
    searchParams.set("limit", String(params.limit));
  }

  const response = await apiFetch(
    `${apiConfig.baseUrl}/v1/addresses/de/localities?${searchParams.toString()}`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: response.statusText }));
    throw new ApiError(
      error.message || "Failed to fetch address locality suggestions",
      response.status
    );
  }

  return (await response.json()) as AddressLocalitySuggestionResponse;
}
