// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { apiConfig } from "../config";
import { ApiError } from "./ApiError";
import { apiFetch } from "./csrf";

export interface AddressStreetSuggestion {
  name: string;
  postal_code: string;
  locality: string;
  borough?: string | null;
  suburb?: string | null;
  regional_key?: string | null;
}

export interface AddressLocalitySuggestion {
  postal_code: string;
  locality: string;
}

interface AddressApiResponse<T> {
  data: T[];
}

export async function fetchAddressStreetSuggestions(params: {
  name?: string;
  postalCode?: string;
  locality?: string;
  limit?: number;
}): Promise<AddressStreetSuggestion[]> {
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

  const payload =
    (await response.json()) as AddressApiResponse<AddressStreetSuggestion>;
  return payload.data ?? [];
}

export async function fetchAddressLocalitySuggestions(params: {
  postalCode?: string;
  locality?: string;
  limit?: number;
}): Promise<AddressLocalitySuggestion[]> {
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

  const payload =
    (await response.json()) as AddressApiResponse<AddressLocalitySuggestion>;
  return payload.data ?? [];
}
