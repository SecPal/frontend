// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/* eslint-disable @typescript-eslint/no-explicit-any */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiConfig } from "../config";
import { listCustomerLegalEntities } from "./customerLegalEntitiesApi";
import * as csrf from "./csrf";

vi.mock("./csrf");

describe("customerLegalEntitiesApi", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches only the customer legal entity lookup endpoint", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [
          {
            id: "550e8400-e29b-41d4-a716-446655440001",
            name: "SecPal GmbH",
          },
        ],
      }),
    };

    vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

    const result = await listCustomerLegalEntities();

    expect(csrf.apiFetch).toHaveBeenCalledWith(
      `${apiConfig.baseUrl}/v1/lookups/legal-entities`
    );
    expect(result).toEqual([
      {
        id: "550e8400-e29b-41d4-a716-446655440001",
        name: "SecPal GmbH",
      },
    ]);
  });

  it("rejects missing lookup fields", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [{ id: "550e8400-e29b-41d4-a716-446655440001" }],
      }),
    };

    vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

    await expect(listCustomerLegalEntities()).rejects.toThrow(
      /legal entity lookup response/i
    );
  });

  it("rejects a malformed top-level response consistently", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue(null),
    };

    vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

    await expect(listCustomerLegalEntities()).rejects.toThrow(
      /legal entity lookup response/i
    );
  });

  it("rejects widened organizational unit responses", async () => {
    const mockResponse = {
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: [
          {
            id: "550e8400-e29b-41d4-a716-446655440001",
            name: "SecPal GmbH",
            type: "company",
            is_legal_entity: true,
          },
        ],
      }),
    };

    vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

    await expect(listCustomerLegalEntities()).rejects.toThrow(
      /legal entity lookup response/i
    );
  });

  it("surfaces API errors", async () => {
    const mockResponse = {
      ok: false,
      status: 403,
      statusText: "Forbidden",
      json: vi.fn().mockResolvedValue({ message: "Forbidden" }),
    };

    vi.mocked(csrf.apiFetch).mockResolvedValue(mockResponse as any);

    await expect(listCustomerLegalEntities()).rejects.toThrow("Forbidden");
  });
});
