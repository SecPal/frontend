// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiConfig } from "../config";
import type { CustomerTransactionalEditRequest } from "@/types/api/customers";
import {
  getCustomerEditSnapshot,
  transactionallyEditCustomer,
} from "./customersApi";
import * as csrf from "./csrf";

vi.mock("./csrf");

const customer = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  customer_number: "KD-1",
  legal_entity_id: "770e8400-e29b-41d4-a716-446655440000",
  name: "ACME GmbH",
  billing_address: {
    street: "Street 1",
    postal_code: "10115",
    city: "Berlin",
    country: "DE",
  },
  is_active: true,
  customer_establishments: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("transactional customer edit API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retains the strong ETag with the complete customer snapshot", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ data: customer }), {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          ETag: '"customer-v1"',
        },
      })
    );

    await expect(getCustomerEditSnapshot(customer.id)).resolves.toEqual({
      customer,
      etag: '"customer-v1"',
    });
  });

  it("fails closed when the customer response has no edit validator", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ data: customer }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(getCustomerEditSnapshot(customer.id)).rejects.toThrow(
      "Failed to load customer edit snapshot"
    );
  });

  it("puts the generated request with its exact If-Match validator", async () => {
    const request: CustomerTransactionalEditRequest = {
      customer: { name: "Updated ACME GmbH" },
      customer_establishments: [],
    };
    vi.mocked(csrf.apiFetch).mockResolvedValue(
      new Response(JSON.stringify({ data: customer }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    await expect(
      transactionallyEditCustomer(customer.id, '"customer-v1"', request)
    ).resolves.toEqual(customer);
    expect(csrf.apiFetch).toHaveBeenCalledWith(
      `${apiConfig.baseUrl}/v1/customers/${customer.id}/transactional-edit`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "If-Match": '"customer-v1"',
        },
        body: JSON.stringify(request),
      }
    );
  });

  it("surfaces the neutral API failure message", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Insufficient permissions",
          code: "FORBIDDEN",
        }),
        {
          status: 403,
          headers: { "Content-Type": "application/json" },
        }
      )
    );

    await expect(
      transactionallyEditCustomer(customer.id, '"customer-v1"', {
        customer: {},
        customer_establishments: [],
      })
    ).rejects.toThrow("Insufficient permissions");
  });
});
