// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import type {
  CreateCustomerRequest,
  Customer,
  CustomerTransactionalEditRequest,
  CustomerTransactionalEditResult,
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

  it("requires caller-visible establishment links on customer reads", () => {
    const customerEstablishmentsAreRequired: Pick<
      Customer,
      "customer_establishments"
    > extends Required<Pick<Customer, "customer_establishments">>
      ? true
      : false = true;
    const customerEstablishments: Customer["customer_establishments"] = [
      {
        id: "790e8400-e29b-41d4-a716-446655440000",
        customer_id: "550e8400-e29b-41d4-a716-446655440000",
        establishment_id: "780e8400-e29b-41d4-a716-446655440000",
        created_at: "2025-12-05T10:00:00Z",
        updated_at: "2025-12-15T14:30:00Z",
      },
    ];

    expect(customerEstablishments[0]?.establishment_id).toBe(
      "780e8400-e29b-41d4-a716-446655440000"
    );
    expect(customerEstablishmentsAreRequired).toBe(true);
  });

  it("allows legal entity reassignment in customer updates", () => {
    const update: UpdateCustomerRequest = {
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440002",
    };

    expect(update.legal_entity_id).toBe("550e8400-e29b-41d4-a716-446655440002");
  });

  it("requires one customer patch and complete desired assignment snapshot", () => {
    const request: CustomerTransactionalEditRequest = {
      customer: { name: "Updated customer" },
      customer_establishments: [
        {
          customer_id: "550e8400-e29b-41d4-a716-446655440000",
          establishment_id: "780e8400-e29b-41d4-a716-446655440000",
          contact_name: null,
        },
      ],
    };
    const committedAssignmentsAreRequired: Pick<
      CustomerTransactionalEditResult,
      "customer_establishments"
    > extends Required<
      Pick<CustomerTransactionalEditResult, "customer_establishments">
    >
      ? true
      : false = true;

    expect(request.customer_establishments).toHaveLength(1);
    expect(committedAssignmentsAreRequired).toBe(true);
  });
});
