// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, expect, it } from "vitest";
import type {
  CreateCustomerRequest,
  Customer,
  UpdateCustomerRequest,
} from "./customers";

describe("generated customer API types", () => {
  it("syncs required legal entity ids onto customer reads and creates", () => {
    const customerLegalEntityId: Customer["legal_entity_id"] =
      "550e8400-e29b-41d4-a716-446655440001";
    const createLegalEntityId: CreateCustomerRequest["legal_entity_id"] =
      customerLegalEntityId;

    expect(createLegalEntityId).toBe(customerLegalEntityId);
  });

  it("allows legal entity reassignment in customer updates", () => {
    const update: UpdateCustomerRequest = {
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440002",
    };

    expect(update.legal_entity_id).toBe(
      "550e8400-e29b-41d4-a716-446655440002"
    );
  });
});
