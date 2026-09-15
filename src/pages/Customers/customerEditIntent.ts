// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { CustomerEstablishmentFormValue } from "@/components/CustomerEstablishmentFields";
import type { Customer, UpdateCustomerRequest } from "@/types/api/customers";

export interface CustomerEditIntent {
  form: UpdateCustomerRequest;
  assignments: CustomerEstablishmentFormValue[];
}

const assignmentFields = [
  "establishment_id",
  "contact_name",
  "email",
  "phone",
  "comments",
] as const;
const normalizedAssignmentFields = new Set<(typeof assignmentFields)[number]>([
  "contact_name",
  "email",
  "phone",
  "comments",
]);

export function normalizeCustomerEditOptionalText(
  value: string | null | undefined
): string {
  return value?.trim() ?? "";
}

function chooseIntendedOptionalText(
  original: string | null | undefined,
  intended: string | null | undefined,
  fresh: string | null | undefined
): string | null | undefined {
  return normalizeCustomerEditOptionalText(intended) !==
    normalizeCustomerEditOptionalText(original)
    ? intended
    : fresh;
}

export function emptyCustomerAssignment(): CustomerEstablishmentFormValue {
  return {
    key: crypto.randomUUID(),
    establishment_id: "",
    contact_name: "",
    email: "",
    phone: "",
    comments: "",
  };
}

export function customerEditIntentFromCustomer(
  customer: Customer
): CustomerEditIntent {
  const assignments = customer.customer_establishments.map((link) => ({
    key: link.id,
    id: link.id,
    establishment_id: link.establishment_id,
    contact_name: link.contact_name ?? "",
    email: link.email ?? "",
    phone: link.phone ?? "",
    comments: link.comments ?? "",
  }));

  return {
    form: {
      name: customer.name,
      vat_id: customer.vat_id ?? null,
      billing_address: customer.billing_address,
      is_active: customer.is_active,
    },
    assignments: assignments.length ? assignments : [emptyCustomerAssignment()],
  };
}

function chooseIntendedChange<T>(original: T, intended: T, fresh: T): T {
  return intended !== original ? intended : fresh;
}

function assignmentChanged(
  original: CustomerEstablishmentFormValue,
  intended: CustomerEstablishmentFormValue
): boolean {
  return assignmentFields.some(
    (field) =>
      normalizedAssignmentValue(field, original[field]) !==
      normalizedAssignmentValue(field, intended[field])
  );
}

function normalizedAssignmentValue(
  field: (typeof assignmentFields)[number],
  value: string
): string {
  return normalizedAssignmentFields.has(field)
    ? normalizeCustomerEditOptionalText(value)
    : value;
}

function mergeAssignmentChanges(
  original: CustomerEstablishmentFormValue,
  intended: CustomerEstablishmentFormValue,
  fresh: CustomerEstablishmentFormValue
): CustomerEstablishmentFormValue {
  const merged = { ...fresh };
  for (const field of assignmentFields) {
    if (
      normalizedAssignmentValue(field, original[field]) !==
      normalizedAssignmentValue(field, intended[field])
    ) {
      merged[field] = intended[field];
    }
  }
  return merged;
}

function reconcileAssignments(
  original: CustomerEstablishmentFormValue[],
  intended: CustomerEstablishmentFormValue[],
  fresh: CustomerEstablishmentFormValue[]
): CustomerEstablishmentFormValue[] {
  const reconciled = fresh
    .filter((assignment) => assignment.establishment_id)
    .map((assignment) => ({ ...assignment }));
  const originalKeys = new Set(original.map((assignment) => assignment.key));

  for (const originalAssignment of original) {
    const intendedAssignment = intended.find(
      (assignment) => assignment.key === originalAssignment.key
    );

    if (!originalAssignment.id) {
      if (
        intendedAssignment?.establishment_id &&
        assignmentChanged(originalAssignment, intendedAssignment)
      ) {
        reconciled.push({ ...intendedAssignment });
      }
      continue;
    }

    const freshIndex = reconciled.findIndex(
      (assignment) => assignment.id === originalAssignment.id
    );
    if (!intendedAssignment) {
      if (freshIndex >= 0) reconciled.splice(freshIndex, 1);
      continue;
    }
    if (freshIndex >= 0) {
      reconciled[freshIndex] = mergeAssignmentChanges(
        originalAssignment,
        intendedAssignment,
        reconciled[freshIndex]!
      );
    } else if (assignmentChanged(originalAssignment, intendedAssignment)) {
      reconciled.push({ ...intendedAssignment });
    }
  }

  for (const intendedAssignment of intended) {
    if (
      intendedAssignment.establishment_id &&
      !originalKeys.has(intendedAssignment.key)
    ) {
      reconciled.push({ ...intendedAssignment });
    }
  }

  return reconciled.length ? reconciled : [emptyCustomerAssignment()];
}

export function reconcileCustomerEditIntent(
  original: CustomerEditIntent,
  intended: CustomerEditIntent,
  fresh: CustomerEditIntent
): CustomerEditIntent {
  const originalAddress = original.form.billing_address;
  const intendedAddress = intended.form.billing_address;
  const freshAddress = fresh.form.billing_address;

  return {
    form: {
      ...fresh.form,
      name: chooseIntendedChange(
        original.form.name,
        intended.form.name,
        fresh.form.name
      ),
      vat_id: chooseIntendedOptionalText(
        original.form.vat_id,
        intended.form.vat_id,
        fresh.form.vat_id
      ),
      is_active: chooseIntendedChange(
        original.form.is_active,
        intended.form.is_active,
        fresh.form.is_active
      ),
      billing_address:
        originalAddress && intendedAddress && freshAddress
          ? {
              ...freshAddress,
              street: chooseIntendedChange(
                originalAddress.street,
                intendedAddress.street,
                freshAddress.street
              ),
              postal_code: chooseIntendedChange(
                originalAddress.postal_code,
                intendedAddress.postal_code,
                freshAddress.postal_code
              ),
              city: chooseIntendedChange(
                originalAddress.city,
                intendedAddress.city,
                freshAddress.city
              ),
              country: chooseIntendedChange(
                originalAddress.country,
                intendedAddress.country,
                freshAddress.country
              ),
            }
          : intendedAddress,
    },
    assignments: reconcileAssignments(
      original.assignments,
      intended.assignments,
      fresh.assignments
    ),
  };
}
