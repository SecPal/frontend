// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { CustomerEstablishmentFormValue } from "@/components/CustomerEstablishmentFields";
import type {
  CreateCustomerEstablishmentRequest,
  CustomerEstablishment,
  UpdateCustomerEstablishmentRequest,
} from "@/types/api/customers";
import {
  createCustomerEstablishment,
  deleteCustomerEstablishment,
  updateCustomerEstablishment,
} from "../../services/customerDomainApi";

export class CustomerEstablishmentRecoveryError extends Error {
  constructor(public readonly originalError: unknown) {
    super("Customer establishment recovery failed");
    this.name = "CustomerEstablishmentRecoveryError";
  }
}

interface CustomerEstablishmentChangePlan {
  unchanged: CustomerEstablishmentFormValue[];
  create: CustomerEstablishmentFormValue[];
  deleteBeforeCreate: CustomerEstablishment[];
  deleteAfterCreate: CustomerEstablishment[];
}

const optional = (value: string): string | null => value.trim() || null;

function contactsFor(item: CustomerEstablishmentFormValue) {
  return {
    contact_name: optional(item.contact_name),
    email: optional(item.email),
    phone: optional(item.phone),
    comments: optional(item.comments),
  };
}

function createRequestForOriginal(
  customerId: string,
  item: CustomerEstablishment
): CreateCustomerEstablishmentRequest {
  return {
    customer_id: customerId,
    establishment_id: item.establishment_id,
    contact_name: item.contact_name ?? null,
    email: item.email ?? null,
    phone: item.phone ?? null,
    comments: item.comments ?? null,
  };
}

function contactsForOriginal(
  item: CustomerEstablishment
): UpdateCustomerEstablishmentRequest {
  return {
    contact_name: item.contact_name ?? null,
    email: item.email ?? null,
    phone: item.phone ?? null,
    comments: item.comments ?? null,
  };
}

export function planCustomerEstablishmentChanges(
  assignments: CustomerEstablishmentFormValue[],
  originals: CustomerEstablishment[]
): CustomerEstablishmentChangePlan {
  const originalsById = new Map(originals.map((item) => [item.id, item]));
  const unchanged = assignments.filter((item) => {
    const original = item.id ? originalsById.get(item.id) : undefined;
    return original?.establishment_id === item.establishment_id;
  });
  const unchangedIds = new Set(
    unchanged.flatMap((item) => (item.id ? [item.id] : []))
  );
  const create = assignments.filter((item) => !unchanged.includes(item));
  const originalsToDelete = originals.filter(
    (item) => !unchangedIds.has(item.id)
  );
  const requestedEstablishments = new Set(
    create.map((item) => item.establishment_id)
  );
  const deleteBeforeCreate = originalsToDelete.filter((item) =>
    requestedEstablishments.has(item.establishment_id)
  );
  const deleteBeforeCreateIds = new Set(
    deleteBeforeCreate.map((item) => item.id)
  );

  return {
    unchanged,
    create,
    deleteBeforeCreate,
    deleteAfterCreate: originalsToDelete.filter(
      (item) => !deleteBeforeCreateIds.has(item.id)
    ),
  };
}

export async function reconcileCustomerEstablishments(
  customerId: string,
  assignments: CustomerEstablishmentFormValue[],
  originals: CustomerEstablishment[]
): Promise<void> {
  const plan = planCustomerEstablishmentChanges(assignments, originals);
  const originalsById = new Map(originals.map((item) => [item.id, item]));
  const updated: CustomerEstablishment[] = [];
  const deleted: CustomerEstablishment[] = [];
  const created: CustomerEstablishment[] = [];
  try {
    for (const item of plan.unchanged) {
      await updateCustomerEstablishment(item.id!, contactsFor(item));
      updated.push(originalsById.get(item.id!)!);
    }
    for (const item of plan.deleteBeforeCreate) {
      await deleteCustomerEstablishment(item.id);
      deleted.push(item);
    }
    for (const item of plan.create) {
      created.push(
        await createCustomerEstablishment({
          customer_id: customerId,
          establishment_id: item.establishment_id,
          ...contactsFor(item),
        })
      );
    }
    for (const item of plan.deleteAfterCreate) {
      await deleteCustomerEstablishment(item.id);
      deleted.push(item);
    }
  } catch (error) {
    const cleanup = await Promise.allSettled(
      created.map((item) => deleteCustomerEstablishment(item.id))
    );
    const restoration = await Promise.allSettled(
      deleted.map((item) =>
        createCustomerEstablishment(createRequestForOriginal(customerId, item))
      )
    );
    const contactRestoration = await Promise.allSettled(
      updated.map((item) =>
        updateCustomerEstablishment(item.id, contactsForOriginal(item))
      )
    );
    if (
      cleanup.some((result) => result.status === "rejected") ||
      restoration.some((result) => result.status === "rejected") ||
      contactRestoration.some((result) => result.status === "rejected")
    ) {
      throw new CustomerEstablishmentRecoveryError(error);
    }
    throw error;
  }
}
