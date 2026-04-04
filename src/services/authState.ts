// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { User } from "../contexts/auth-context";

export interface SanitizeAuthUserOptions {
  includeEmployee?: boolean;
}

export type PersistedAuthUser = Omit<User, "employee">;

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

function sanitizeAuthUserId(value: unknown): User["id"] | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }

  return null;
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
  const sanitizedId = sanitizeAuthUserId(candidate.id);

  if (
    sanitizedId === null ||
    typeof candidate.name !== "string" ||
    typeof candidate.email !== "string"
  ) {
    return null;
  }

  const sanitizedUser: User = {
    id: sanitizedId,
    name: candidate.name,
    email: candidate.email,
    emailVerified: sanitizeBoolean(candidate.emailVerified) ?? false,
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

export function sanitizePersistedAuthUser(
  value: unknown
): PersistedAuthUser | null {
  const sanitizedUser = sanitizeAuthUser(value, {
    includeEmployee: false,
  });

  if (!sanitizedUser) {
    return null;
  }

  const persistedAuthUser: PersistedAuthUser = {
    id: sanitizedUser.id,
    name: sanitizedUser.name,
    email: sanitizedUser.email,
    emailVerified: sanitizedUser.emailVerified,
  };

  if (sanitizedUser.roles) {
    persistedAuthUser.roles = sanitizedUser.roles;
  }

  if (sanitizedUser.permissions) {
    persistedAuthUser.permissions = sanitizedUser.permissions;
  }

  if (sanitizedUser.hasOrganizationalScopes !== undefined) {
    persistedAuthUser.hasOrganizationalScopes =
      sanitizedUser.hasOrganizationalScopes;
  }

  if (sanitizedUser.hasCustomerAccess !== undefined) {
    persistedAuthUser.hasCustomerAccess = sanitizedUser.hasCustomerAccess;
  }

  if (sanitizedUser.hasSiteAccess !== undefined) {
    persistedAuthUser.hasSiteAccess = sanitizedUser.hasSiteAccess;
  }

  return persistedAuthUser;
}
