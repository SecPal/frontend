// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { useEffect, useMemo, useState } from "react";
import { listCustomerLegalEntities } from "../services/customerLegalEntitiesApi";
import { listEstablishmentLookups } from "../services/customerDomainApi";

export interface DomainAssignmentReference {
  legal_entity_id: string;
  establishment_id?: string;
}

interface DomainAssignmentNames {
  legalEntities: Record<string, string>;
  establishments: Record<string, string>;
  loading: boolean;
  hasError: boolean;
}

interface LoadedDomainAssignmentNames extends Omit<
  DomainAssignmentNames,
  "loading"
> {
  referenceKey: string;
}

const EMPTY_NAMES: DomainAssignmentNames = {
  legalEntities: {},
  establishments: {},
  loading: false,
  hasError: false,
};

export function useDomainAssignmentNames(
  references: DomainAssignmentReference[]
): DomainAssignmentNames {
  const referenceKey = useMemo(
    () =>
      JSON.stringify(
        references
          .filter((reference) => reference.legal_entity_id)
          .map((reference): [string, string] => [
            reference.legal_entity_id,
            reference.establishment_id ?? "",
          ])
          .sort(
            (
              [leftLegal, leftEstablishment],
              [rightLegal, rightEstablishment]
            ) =>
              leftLegal === rightLegal
                ? leftEstablishment.localeCompare(rightEstablishment)
                : leftLegal.localeCompare(rightLegal)
          )
      ),
    [references]
  );
  const [loadedNames, setLoadedNames] = useState<LoadedDomainAssignmentNames>({
    referenceKey: "",
    legalEntities: {},
    establishments: {},
    hasError: false,
  });

  useEffect(() => {
    const requested = JSON.parse(referenceKey) as Array<[string, string]>;
    if (requested.length === 0) return;

    let active = true;

    async function loadNames() {
      try {
        const legalEntities = await listCustomerLegalEntities();
        const legalEntityNames = Object.fromEntries(
          legalEntities.map((entity) => [entity.id, entity.name])
        );
        const authorizedLegalEntityIds = new Set(
          legalEntities.map((entity) => entity.id)
        );
        const legalEntityIdsWithEstablishments = [
          ...new Set(
            requested
              .filter(
                ([legalEntityId, establishmentId]) =>
                  establishmentId && authorizedLegalEntityIds.has(legalEntityId)
              )
              .map(([legalEntityId]) => legalEntityId)
          ),
        ];
        const establishmentResults = await Promise.allSettled(
          legalEntityIdsWithEstablishments.map(async (legalEntityId) => ({
            legalEntityId,
            items: await listEstablishmentLookups(legalEntityId),
          }))
        );
        if (!active) return;

        const establishmentNames: Record<string, string> = {};
        for (const result of establishmentResults) {
          if (result.status !== "fulfilled") continue;
          for (const establishment of result.value.items) {
            establishmentNames[establishment.id] = establishment.name;
          }
        }
        setLoadedNames({
          referenceKey,
          legalEntities: legalEntityNames,
          establishments: establishmentNames,
          hasError: establishmentResults.some(
            (result) => result.status === "rejected"
          ),
        });
      } catch {
        if (active) {
          setLoadedNames({
            referenceKey,
            legalEntities: {},
            establishments: {},
            hasError: true,
          });
        }
      }
    }

    void loadNames();
    return () => {
      active = false;
    };
  }, [referenceKey]);

  if (referenceKey === "[]") return EMPTY_NAMES;
  if (loadedNames.referenceKey !== referenceKey) {
    return { ...EMPTY_NAMES, loading: true };
  }
  return {
    legalEntities: loadedNames.legalEntities,
    establishments: loadedNames.establishments,
    loading: false,
    hasError: loadedNames.hasError,
  };
}
