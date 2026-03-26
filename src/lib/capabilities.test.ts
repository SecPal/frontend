// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { getUserCapabilities } from "./capabilities";

describe("getUserCapabilities", () => {
  it("keeps scope-only users in self-service areas", () => {
    const capabilities = getUserCapabilities({
      id: 1,
      name: "Scope User",
      email: "scope.user@secpal.dev",
      hasOrganizationalScopes: true,
      roles: [],
      permissions: [],
    });

    expect(capabilities.home).toBe(true);
    expect(capabilities.profile).toBe(true);
    expect(capabilities.settings).toBe(true);
    expect(capabilities.organization).toBe(false);
    expect(capabilities.customers).toBe(false);
    expect(capabilities.sites).toBe(false);
    expect(capabilities.employees).toBe(false);
    expect(capabilities.activityLogs).toBe(false);
  });

  it("enables management areas for elevated organization roles", () => {
    const capabilities = getUserCapabilities({
      id: 1,
      name: "Manager User",
      email: "manager.user@secpal.dev",
      hasOrganizationalScopes: true,
      roles: ["Manager"],
      permissions: [],
    });

    expect(capabilities.organization).toBe(true);
    expect(capabilities.customers).toBe(true);
    expect(capabilities.sites).toBe(true);
    expect(capabilities.employees).toBe(true);
  });

  it("enables customer and site features from explicit permissions", () => {
    const capabilities = getUserCapabilities({
      id: 1,
      name: "Customer User",
      email: "customer.user@secpal.dev",
      roles: [],
      permissions: ["customers.read", "sites.read"],
    });

    expect(capabilities.customers).toBe(true);
    expect(capabilities.sites).toBe(true);
    expect(capabilities.organization).toBe(false);
    expect(capabilities.employees).toBe(false);
  });
});
