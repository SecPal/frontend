// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/* eslint-disable @typescript-eslint/no-explicit-any */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiConfig } from "../config";
import * as csrf from "./csrf";
import {
  createCustomerEstablishmentRelationship,
  deleteCustomerEstablishmentRelationship,
  listCustomerEstablishmentOptions,
  listCustomerEstablishmentRelationships,
  updateCustomerEstablishmentRelationship,
} from "./customersApi";

vi.mock("./csrf");

const establishment = {
  id: "550e8400-e29b-41d4-a716-446655440010",
  name: "Berlin Establishment",
};

const relationship = {
  id: "550e8400-e29b-41d4-a716-446655440020",
  customer_id: "550e8400-e29b-41d4-a716-446655440030",
  establishment_id: establishment.id,
  establishment,
  contact: null,
  notes: "Gatehouse",
  created_at: "2026-07-16T10:00:00Z",
  updated_at: "2026-07-16T10:00:00Z",
};

describe("customer establishment API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads minimal establishment options for one legal entity", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [establishment] }),
    } as any);

    await expect(
      listCustomerEstablishmentOptions("550e8400-e29b-41d4-a716-446655440001")
    ).resolves.toEqual([establishment]);
    expect(csrf.apiFetch).toHaveBeenCalledWith(
      `${apiConfig.baseUrl}/v1/customers/establishments?legal_entity_id=550e8400-e29b-41d4-a716-446655440001`
    );
  });

  it.each([
    null,
    {},
    { data: null },
    { data: [{ id: establishment.id }] },
    { data: [{ ...establishment, type: "branch" }] },
    { data: [{ id: 42, name: establishment.name }] },
  ])(
    "rejects an invalid or widened establishment payload %#",
    async (payload) => {
      vi.mocked(csrf.apiFetch).mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(payload),
      } as any);

      await expect(
        listCustomerEstablishmentOptions("550e8400-e29b-41d4-a716-446655440001")
      ).rejects.toThrow(/invalid establishment lookup response/i);
    }
  );

  it("surfaces establishment lookup API errors", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: false,
      statusText: "Forbidden",
      json: vi.fn().mockResolvedValue({ message: "Forbidden" }),
    } as any);

    await expect(
      listCustomerEstablishmentOptions("550e8400-e29b-41d4-a716-446655440001")
    ).rejects.toThrow("Forbidden");
  });

  it("lists visible relationships on the contracted path", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: [relationship] }),
    } as any);

    await expect(
      listCustomerEstablishmentRelationships(relationship.customer_id)
    ).resolves.toEqual([relationship]);
    expect(csrf.apiFetch).toHaveBeenCalledWith(
      `${apiConfig.baseUrl}/v1/customers/${relationship.customer_id}/establishments`
    );
  });

  it("creates a relationship with the contracted payload", async () => {
    const payload = {
      establishment_id: establishment.id,
      contact: null,
      notes: "Gatehouse",
    };
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ data: relationship }),
    } as any);

    await expect(
      createCustomerEstablishmentRelationship(relationship.customer_id, payload)
    ).resolves.toEqual(relationship);
    expect(csrf.apiFetch).toHaveBeenCalledWith(
      `${apiConfig.baseUrl}/v1/customers/${relationship.customer_id}/establishments`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
  });

  it("updates a relationship with the contracted payload", async () => {
    const payload = { notes: "Updated" };
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        data: { ...relationship, notes: "Updated" },
      }),
    } as any);

    await expect(
      updateCustomerEstablishmentRelationship(
        relationship.customer_id,
        relationship.id,
        payload
      )
    ).resolves.toMatchObject(payload);
    expect(csrf.apiFetch).toHaveBeenCalledWith(
      `${apiConfig.baseUrl}/v1/customers/${relationship.customer_id}/establishments/${relationship.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
  });

  it("deletes a relationship on the contracted path", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue({ ok: true } as any);

    await deleteCustomerEstablishmentRelationship(
      relationship.customer_id,
      relationship.id
    );

    expect(csrf.apiFetch).toHaveBeenCalledWith(
      `${apiConfig.baseUrl}/v1/customers/${relationship.customer_id}/establishments/${relationship.id}`,
      { method: "DELETE" }
    );
  });

  it("rejects malformed relationship response envelopes", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    } as any);

    await expect(
      createCustomerEstablishmentRelationship(relationship.customer_id, {
        establishment_id: establishment.id,
      })
    ).rejects.toThrow(/parse relationship response/i);
  });

  it("preserves relationship validation errors", async () => {
    vi.mocked(csrf.apiFetch).mockResolvedValue({
      ok: false,
      json: vi.fn().mockResolvedValue({
        message: "The given data was invalid.",
        errors: { establishment_id: ["The establishment is invalid."] },
      }),
    } as any);

    await expect(
      createCustomerEstablishmentRelationship(relationship.customer_id, {
        establishment_id: establishment.id,
      })
    ).rejects.toThrow("establishment_id: The establishment is invalid.");
  });
});
