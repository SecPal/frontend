// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { sanitizeAuthUser, sanitizePersistedAuthUser } from "./authState";

describe("authState", () => {
  it("accepts UUID-style string ids from the auth API", () => {
    const sanitizedUser = sanitizeAuthUser({
      id: "019d30f1-767e-7210-bc31-2b8c1985bb61",
      name: "Test User",
      email: "test@secpal.dev",
      roles: [],
      permissions: [],
      hasOrganizationalScopes: false,
      hasCustomerAccess: false,
      hasSiteAccess: false,
    });

    expect(sanitizedUser).toEqual({
      id: "019d30f1-767e-7210-bc31-2b8c1985bb61",
      name: "Test User",
      email: "test@secpal.dev",
      hasOrganizationalScopes: false,
      hasCustomerAccess: false,
      hasSiteAccess: false,
    });
  });

  it("keeps employee data in ephemeral auth state by default", () => {
    const sanitizedUser = sanitizeAuthUser({
      id: 1,
      name: "Test User",
      email: "test@secpal.app",
      employee: {
        management_level: 7,
      },
    });

    expect(sanitizedUser).toEqual({
      id: "1",
      name: "Test User",
      email: "test@secpal.app",
      employee: {
        management_level: 7,
      },
    });
  });

  it("drops employee data when building persisted auth state", () => {
    const sanitizedUser = sanitizePersistedAuthUser({
      id: 1,
      name: "Test User",
      email: "test@secpal.app",
      employee: {
        management_level: 7,
        personnel_number: "EMP-12345",
      },
    });

    expect(sanitizedUser).toEqual({
      id: "1",
      name: "Test User",
      email: "test@secpal.app",
    });
    expect(sanitizedUser).not.toHaveProperty("employee");
  });

  it("persists UUID-style string ids without dropping a valid auth user", () => {
    const sanitizedUser = sanitizePersistedAuthUser({
      id: "019d30f1-767e-7210-bc31-2b8c1985bb61",
      name: "Persisted User",
      email: "persisted@secpal.dev",
    });

    expect(sanitizedUser).toEqual({
      id: "019d30f1-767e-7210-bc31-2b8c1985bb61",
      name: "Persisted User",
      email: "persisted@secpal.dev",
    });
  });
});
