// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/* eslint-disable @typescript-eslint/no-explicit-any */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiConfig } from "../config";
import * as csrf from "./csrf";
import {
  createCustomerEstablishment,
  DuplicateResourceError,
  listCustomerEstablishments,
  listCustomerLookups,
  listEstablishmentLookups,
} from "./customerDomainApi";

vi.mock("./csrf");

describe("customerDomainApi", () => {
  beforeEach(() => vi.clearAllMocks());

  it("loads minimal establishment lookups for the selected legal entity", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [{ id: "establishment-1", name: "Berlin" }],
      }),
    } as any);

    await expect(listEstablishmentLookups("legal-entity-1")).resolves.toEqual([
      { id: "establishment-1", name: "Berlin" },
    ]);
    expect(csrf.apiFetch).toHaveBeenCalledWith(
      `${apiConfig.baseUrl}/v1/lookups/legal-entities/legal-entity-1/establishments`
    );
  });

  it("rejects unexpected lookup fields", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [
          {
            id: "establishment-1",
            name: "Berlin",
            tenant_id: "private-tenant-id",
          },
        ],
      }),
    } as any);

    await expect(listEstablishmentLookups("legal-entity-1")).rejects.toThrow(
      /lookup response/i
    );
  });

  it("loads minimal customer lookups for the selected establishment", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [{ id: "customer-1", name: "ACME GmbH" }],
      }),
    } as any);

    await expect(listCustomerLookups("establishment-1")).resolves.toEqual([
      { id: "customer-1", name: "ACME GmbH" },
    ]);
    expect(csrf.apiFetch).toHaveBeenCalledWith(
      `${apiConfig.baseUrl}/v1/lookups/establishments/establishment-1/customers`
    );
  });

  it("identifies malformed customer lookup payloads accurately", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [{ id: "customer-1", name: "ACME GmbH", tenant_id: "private" }],
      }),
    } as any);

    await expect(listCustomerLookups("establishment-1")).rejects.toThrow(
      "Invalid customer lookup response"
    );
  });

  it("filters assignments by customer without OU parameters", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [], meta: { total: 0 } }),
    } as any);

    await listCustomerEstablishments({ customer_id: "customer-1" });

    expect(csrf.apiFetch).toHaveBeenCalledWith(
      `${apiConfig.baseUrl}/v1/customer-establishments?customer_id=customer-1`
    );
  });

  it("replaces duplicate details with the neutral domain error", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: false,
      status: 409,
      statusText: "Conflict",
      json: vi.fn().mockResolvedValue({
        code: "DUPLICATE_RESOURCE",
        message: "VAT DE123 belongs to Existing Customer GmbH",
      }),
    } as any);

    const request = createCustomerEstablishment({
      customer_id: "customer-1",
      establishment_id: "establishment-1",
    });

    await expect(request).rejects.toBeInstanceOf(DuplicateResourceError);
    await expect(request).rejects.toThrow("A matching record already exists.");
  });
});
