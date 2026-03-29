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
    expect(capabilities.actions.customers.create).toBe(false);
    expect(capabilities.actions.sites.update).toBe(false);
    expect(capabilities.actions.employees.activate).toBe(false);
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
    expect(capabilities.actions.customers.create).toBe(true);
    expect(capabilities.actions.sites.delete).toBe(true);
    expect(capabilities.actions.employees.terminate).toBe(true);
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
    expect(capabilities.actions.customers.create).toBe(false);
    expect(capabilities.actions.sites.create).toBe(false);
  });

  it("does not leak the site feature from customer-only read access", () => {
    const capabilities = getUserCapabilities({
      id: 1,
      name: "Customer Reader",
      email: "customer.reader@secpal.dev",
      roles: [],
      permissions: ["customers.read"],
    });

    expect(capabilities.customers).toBe(true);
    expect(capabilities.sites).toBe(false);
  });

  it("does not unlock customer or site features from assignment mutation permissions alone", () => {
    const capabilities = getUserCapabilities({
      id: 1,
      name: "Assignment Operator",
      email: "assignment.operator@secpal.dev",
      roles: [],
      permissions: ["assignments.create"],
    });

    expect(capabilities.customers).toBe(false);
    expect(capabilities.sites).toBe(false);
  });

  it("enables customer and site features from backend scoped-access flags", () => {
    const capabilities = getUserCapabilities({
      id: 1,
      name: "Scoped Access User",
      email: "scoped.access@secpal.dev",
      roles: [],
      permissions: [],
      hasCustomerAccess: true,
      hasSiteAccess: true,
    });

    expect(capabilities.customers).toBe(true);
    expect(capabilities.sites).toBe(true);
    expect(capabilities.actions.customers.create).toBe(false);
    expect(capabilities.actions.sites.delete).toBe(false);
  });

  it("grants action capabilities from explicit action permissions", () => {
    const capabilities = getUserCapabilities({
      id: 1,
      name: "Action User",
      email: "action.user@secpal.dev",
      roles: [],
      permissions: ["customers.create", "sites.update"],
    });

    expect(capabilities.actions.customers.create).toBe(true);
    expect(capabilities.actions.customers.update).toBe(false);
    expect(capabilities.actions.customers.delete).toBe(false);
    expect(capabilities.actions.sites.create).toBe(false);
    expect(capabilities.actions.sites.update).toBe(true);
    expect(capabilities.actions.sites.delete).toBe(false);
  });

  it("grants employee action capabilities from explicit permissions with org scopes", () => {
    const capabilities = getUserCapabilities({
      id: 1,
      name: "Employee Manager",
      email: "emp.manager@secpal.dev",
      hasOrganizationalScopes: true,
      roles: [],
      permissions: ["employees.activate", "employees.terminate"],
    });

    expect(capabilities.actions.employees.activate).toBe(true);
    expect(capabilities.actions.employees.terminate).toBe(true);
    expect(capabilities.actions.employees.create).toBe(false);
  });

  it("blocks employee action capabilities without org scopes even with matching permissions", () => {
    const capabilities = getUserCapabilities({
      id: 1,
      name: "External User",
      email: "external.user@secpal.dev",
      hasOrganizationalScopes: false,
      roles: [],
      permissions: ["employees.activate", "employees.terminate"],
    });

    expect(capabilities.actions.employees.activate).toBe(false);
    expect(capabilities.actions.employees.terminate).toBe(false);
    expect(capabilities.employees).toBe(false);
  });
});
