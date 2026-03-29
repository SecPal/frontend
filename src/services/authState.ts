// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { User } from "../contexts/auth-context";

export interface SanitizeAuthUserOptions {
  includeEmployee?: boolean;
}

function sanitizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const sanitizedValues = value.filter(
    (entry): entry is string => typeof entry === "string"
  );

  return sanitizedValues.length > 0 ? sanitizedValues : undefined;
}

function sanitizeBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

export function sanitizeAuthUser(
  value: unknown,
  options: SanitizeAuthUserOptions = {}
): User | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }

  const includeEmployee = options.includeEmployee ?? true;

  const candidate = value as Record<string, unknown>;

  if (
    typeof candidate.id !== "number" ||
    !Number.isFinite(candidate.id) ||
    typeof candidate.name !== "string" ||
    typeof candidate.email !== "string"
  ) {
    return null;
  }

  const sanitizedUser: User = {
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
  };

  const roles = sanitizeStringArray(candidate.roles);
  if (roles) {
    sanitizedUser.roles = roles;
  }

  const permissions = sanitizeStringArray(candidate.permissions);
  if (permissions) {
    sanitizedUser.permissions = permissions;
  }

  const hasOrganizationalScopes = sanitizeBoolean(
    candidate.hasOrganizationalScopes
  );
  if (hasOrganizationalScopes !== undefined) {
    sanitizedUser.hasOrganizationalScopes = hasOrganizationalScopes;
  }

  const hasCustomerAccess = sanitizeBoolean(candidate.hasCustomerAccess);
  if (hasCustomerAccess !== undefined) {
    sanitizedUser.hasCustomerAccess = hasCustomerAccess;
  }

  const hasSiteAccess = sanitizeBoolean(candidate.hasSiteAccess);
  if (hasSiteAccess !== undefined) {
    sanitizedUser.hasSiteAccess = hasSiteAccess;
  }

  if (
    includeEmployee &&
    "employee" in candidate &&
    (typeof candidate.employee === "object" || candidate.employee === null)
  ) {
    sanitizedUser.employee = candidate.employee as User["employee"];
  }

  return sanitizedUser;
}
