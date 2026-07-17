// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { render, screen } from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerDetail from "./CustomerDetail";
import * as customersApi from "../../services/customersApi";
import * as domainApi from "../../services/customerDomainApi";

vi.mock("../../services/customersApi");
vi.mock("../../services/customerDomainApi");
vi.mock("../../hooks/useUserCapabilities", () => ({
  useUserCapabilities: () => ({
    actions: { customers: { update: true, delete: true } },
  }),
}));

function renderPage() {
  window.history.pushState({}, "", "/customers/customer-1");
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <Routes>
          <Route path="/customers/:id" element={<CustomerDetail />} />
        </Routes>
      </I18nProvider>
    </BrowserRouter>
  );
}

describe("CustomerDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(customersApi.getCustomer).mockResolvedValue({
      id: "customer-1",
      customer_number: "KD-1",
      legal_entity_id: "legal-1",
      vat_id: "DE123",
      name: "ACME GmbH",
      billing_address: {
        street: "Street 1",
        postal_code: "10115",
        city: "Berlin",
        country: "DE",
      },
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    vi.mocked(domainApi.listCustomerEstablishments).mockResolvedValue({
      data: [
        {
          id: "link-1",
          customer_id: "customer-1",
          establishment_id: "est-1",
          contact_name: "Berlin Contact",
          email: "berlin@secpal.dev",
          phone: "+49 30 123",
          comments: "Service entrance",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 },
    });
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "est-1", name: "Berlin Establishment" },
    ]);
  });

  it("renders legal-entity master data and local contacts in separate sections", async () => {
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "ACME GmbH" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /legal entity/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: /establishments and local contacts/i,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Berlin Establishment" })
    ).toBeInTheDocument();
    expect(screen.getByText("Berlin Contact")).toBeInTheDocument();
    expect(screen.getByText("berlin@secpal.dev").closest("a")).toHaveAttribute(
      "href",
      "mailto:berlin@secpal.dev"
    );
    expect(screen.queryByText(/organizational unit/i)).not.toBeInTheDocument();
  });
});
