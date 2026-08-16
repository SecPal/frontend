// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDomainAssignmentNames } from "./useDomainAssignmentNames";
import * as legalEntityApi from "../services/customerLegalEntitiesApi";
import * as domainApi from "../services/customerDomainApi";

vi.mock("../services/customerLegalEntitiesApi");
vi.mock("../services/customerDomainApi");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe("useDomainAssignmentNames", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads names across authorized legal entities without querying unauthorized references", async () => {
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockResolvedValue([
      { id: "legal-1", name: "SecPal GmbH" },
      { id: "legal-2", name: "Operations GmbH" },
    ]);
    vi.mocked(domainApi.listEstablishmentLookups).mockImplementation(
      async (legalEntityId) =>
        legalEntityId === "legal-1"
          ? [{ id: "est-1", name: "Berlin" }]
          : [{ id: "est-2", name: "Hamburg" }]
    );

    const { result } = renderHook(() =>
      useDomainAssignmentNames([
        { legal_entity_id: "legal-1", establishment_id: "est-1" },
        { legal_entity_id: "legal-2", establishment_id: "est-2" },
        { legal_entity_id: "unauthorized", establishment_id: "hidden" },
      ])
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current).toMatchObject({
      legalEntities: {
        "legal-1": "SecPal GmbH",
        "legal-2": "Operations GmbH",
      },
      establishments: { "est-1": "Berlin", "est-2": "Hamburg" },
      hasError: false,
    });
    expect(domainApi.listEstablishmentLookups).toHaveBeenCalledTimes(2);
    expect(domainApi.listEstablishmentLookups).not.toHaveBeenCalledWith(
      "unauthorized"
    );
  });

  it("keeps available names when one authorized establishment lookup fails", async () => {
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockResolvedValue([
      { id: "legal-1", name: "SecPal GmbH" },
      { id: "legal-2", name: "Operations GmbH" },
    ]);
    vi.mocked(domainApi.listEstablishmentLookups).mockImplementation(
      async (legalEntityId) => {
        if (legalEntityId === "legal-2") throw new Error("Unavailable");
        return [{ id: "est-1", name: "Berlin" }];
      }
    );

    const { result } = renderHook(() =>
      useDomainAssignmentNames([
        { legal_entity_id: "legal-1", establishment_id: "est-1" },
        { legal_entity_id: "legal-2", establishment_id: "est-2" },
      ])
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.establishments).toEqual({ "est-1": "Berlin" });
    expect(result.current.hasError).toBe(true);
  });

  it("keeps establishment lookup concurrency below the native broker limit", async () => {
    const legalEntities = Array.from({ length: 15 }, (_, index) => ({
      id: `legal-${index}`,
      name: `Legal entity ${index}`,
    }));
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockResolvedValue(
      legalEntities
    );
    let activeLookups = 0;
    let maximumActiveLookups = 0;
    const pendingLookups: Array<
      ReturnType<typeof deferred<Array<{ id: string; name: string }>>>
    > = [];
    vi.mocked(domainApi.listEstablishmentLookups).mockImplementation(
      async (legalEntityId) => {
        activeLookups += 1;
        maximumActiveLookups = Math.max(maximumActiveLookups, activeLookups);
        const lookup = deferred<Array<{ id: string; name: string }>>();
        pendingLookups.push(lookup);
        const items = await lookup.promise;
        activeLookups -= 1;
        return items.length > 0
          ? items
          : [{ id: `est-${legalEntityId}`, name: legalEntityId }];
      }
    );

    const { result } = renderHook(() =>
      useDomainAssignmentNames(
        legalEntities.map((entity, index) => ({
          legal_entity_id: entity.id,
          establishment_id: `est-${index}`,
        }))
      )
    );

    await waitFor(() => expect(pendingLookups).toHaveLength(8));
    expect(maximumActiveLookups).toBe(8);

    while (pendingLookups.length > 0) {
      const batch = pendingLookups.splice(0);
      await act(async () => {
        for (const lookup of batch) lookup.resolve([]);
        await Promise.all(batch.map((lookup) => lookup.promise));
      });
      if (
        vi.mocked(domainApi.listEstablishmentLookups).mock.calls.length < 15
      ) {
        await waitFor(() => expect(pendingLookups.length).toBeGreaterThan(0));
      }
    }

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(domainApi.listEstablishmentLookups).toHaveBeenCalledTimes(15);
    expect(maximumActiveLookups).toBe(8);
    expect(result.current.hasError).toBe(false);
  });

  it("does not let an older lookup overwrite names for newer references", async () => {
    const firstLegalEntities = deferred<Array<{ id: string; name: string }>>();
    vi.mocked(legalEntityApi.listCustomerLegalEntities)
      .mockReturnValueOnce(firstLegalEntities.promise)
      .mockResolvedValueOnce([{ id: "legal-2", name: "Current GmbH" }]);
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "est-2", name: "Current Establishment" },
    ]);

    const { result, rerender } = renderHook(
      ({ legalEntityId, establishmentId }) =>
        useDomainAssignmentNames([
          {
            legal_entity_id: legalEntityId,
            establishment_id: establishmentId,
          },
        ]),
      {
        initialProps: {
          legalEntityId: "legal-1",
          establishmentId: "est-1",
        },
      }
    );

    rerender({ legalEntityId: "legal-2", establishmentId: "est-2" });
    await waitFor(() =>
      expect(result.current.legalEntities).toEqual({
        "legal-2": "Current GmbH",
      })
    );

    await act(async () => {
      firstLegalEntities.resolve([{ id: "legal-1", name: "Stale GmbH" }]);
      await firstLegalEntities.promise;
    });
    expect(result.current.legalEntities).toEqual({
      "legal-2": "Current GmbH",
    });
  });
});
