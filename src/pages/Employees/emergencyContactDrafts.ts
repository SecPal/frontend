// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { EmployeeEmergencyContact } from "@/types/api";

export interface EmergencyContactDraft {
  name: string;
  relationship: string;
  phone: string;
  email: string;
  notes: string;
}

export type EmergencyContactValidationErrorField = "name" | "phone" | "email";

export interface EmergencyContactValidationError {
  index: number;
  field: EmergencyContactValidationErrorField;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function emptyEmergencyContactDraft(): EmergencyContactDraft {
  return {
    name: "",
    relationship: "",
    phone: "",
    email: "",
    notes: "",
  };
}

export function hasEmergencyContactContent(
  draft: EmergencyContactDraft
): boolean {
  return (
    draft.name.trim().length > 0 ||
    draft.phone.trim().length > 0 ||
    draft.email.trim().length > 0 ||
    draft.relationship.trim().length > 0 ||
    draft.notes.trim().length > 0
  );
}

export function emergencyContactsToDrafts(
  contacts: EmployeeEmergencyContact[] | null | undefined
): EmergencyContactDraft[] {
  const existing = contacts ?? [];
  if (existing.length === 0) {
    return [emptyEmergencyContactDraft()];
  }

  return existing.map((contact) => ({
    name: contact.name ?? "",
    relationship: contact.relationship ?? "",
    phone: contact.phone ?? "",
    email: contact.email ?? "",
    notes: contact.notes ?? "",
  }));
}

export function normalizeEmergencyContactDrafts(
  drafts: EmergencyContactDraft[]
): EmployeeEmergencyContact[] {
  return drafts
    .map((draft) => ({
      name: draft.name.trim(),
      relationship: draft.relationship.trim() || null,
      phone: draft.phone.trim(),
      email: draft.email.trim() || null,
      notes: draft.notes.trim() || null,
    }))
    .filter(
      (contact) =>
        contact.name.length > 0 ||
        contact.phone.length > 0 ||
        (contact.email ?? "").length > 0 ||
        (contact.relationship ?? "").length > 0 ||
        (contact.notes ?? "").length > 0
    );
}

export function validateEmergencyContactDrafts(
  drafts: EmergencyContactDraft[]
): EmergencyContactValidationError | null {
  for (const [index, draft] of drafts.entries()) {
    if (!hasEmergencyContactContent(draft)) {
      continue;
    }

    if (draft.name.trim().length === 0) {
      return { index, field: "name" };
    }

    if (draft.phone.trim().length === 0) {
      return { index, field: "phone" };
    }

    const trimmedEmail = draft.email.trim();
    if (trimmedEmail.length > 0 && !emailPattern.test(trimmedEmail)) {
      return { index, field: "email" };
    }
  }

  return null;
}
