// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router";
import { StrictMode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Customer } from "@/types/api/customers";
import CustomerDetail from "./CustomerDetail";
import CustomerEdit from "./CustomerEdit";
import * as customersApi from "../../services/customersApi";
import * as domainApi from "../../services/customerDomainApi";
import * as legalEntityApi from "../../services/customerLegalEntitiesApi";

vi.mock("../../services/customersApi", async (importOriginal) => {
  const actual = await importOriginal<typeof customersApi>();
  return {
    ...actual,
    deleteCustomer: vi.fn(),
    getCustomer: vi.fn(),
    getCustomerEditSnapshot: vi.fn(),
    transactionallyEditCustomer: vi.fn(),
  };
});
vi.mock("../../services/customerDomainApi");
vi.mock("../../services/customerLegalEntitiesApi");
vi.mock("../../hooks/useUserCapabilities", () => ({
  useUserCapabilities: () => ({
    actions: { customers: { update: true, delete: true } },
  }),
}));

const loadedCustomer: Customer = {
  id: "customer-1",
  customer_number: "KD-1",
  legal_entity_id: "legal-1",
  name: "Original Customer",
  billing_address: {
    street: "Street 1",
    postal_code: "10115",
    city: "Berlin",
    country: "DE",
  },
  is_active: true,
  customer_establishments: [
    {
      id: "original-link",
      customer_id: "customer-1",
      establishment_id: "est-1",
      contact_name: "Original Contact",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    },
  ],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

const committedCustomer: Customer = {
  ...loadedCustomer,
  name: "Committed Customer",
  customer_establishments: [
    {
      id: "committed-link",
      customer_id: "customer-1",
      establishment_id: "est-1",
      contact_name: "Committed Contact",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:01Z",
    },
  ],
  updated_at: "2026-01-01T00:00:01Z",
};

function renderFlow() {
  window.history.pushState({}, "", "/customers/customer-1/edit");
  return render(
    <StrictMode>
      <BrowserRouter>
        <I18nProvider i18n={i18n}>
          <Routes>
            <Route path="/customers/:id/edit" element={<CustomerEdit />} />
            <Route path="/customers/:id" element={<CustomerDetail />} />
          </Routes>
        </I18nProvider>
      </BrowserRouter>
    </StrictMode>
  );
}

describe("transactional customer edit projection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(customersApi.getCustomerEditSnapshot).mockResolvedValue({
      customer: loadedCustomer,
      etag: '"customer-v1"',
    });
    vi.mocked(customersApi.transactionallyEditCustomer).mockResolvedValue(
      committedCustomer
    );
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "est-1", name: "Berlin Establishment" },
    ]);
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockResolvedValue([
      { id: "legal-1", name: "SecPal GmbH" },
    ]);
  });

  it("renders the committed projection after save without immediate detail refetches", async () => {
    const user = userEvent.setup();
    renderFlow();

    await screen.findByLabelText(/customer name/i);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByRole("heading", { name: "Committed Customer" })
    ).toBeInTheDocument();
    expect(screen.getByText("Committed Contact")).toBeInTheDocument();
    expect(customersApi.getCustomer).not.toHaveBeenCalled();
    expect(domainApi.listAllCustomerEstablishments).not.toHaveBeenCalled();
  });
});
