// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerEdit from "./CustomerEdit";
import * as customersApi from "../../services/customersApi";
import * as domainApi from "../../services/customerDomainApi";

vi.mock("../../services/customersApi");
vi.mock("../../services/customerDomainApi");
const navigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => navigate,
}));

const customer = {
  id: "customer-1",
  customer_number: "KD-1",
  legal_entity_id: "legal-1",
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
};

function renderPage() {
  window.history.pushState({}, "", "/customers/customer-1/edit");
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <Routes>
          <Route path="/customers/:id/edit" element={<CustomerEdit />} />
        </Routes>
      </I18nProvider>
    </BrowserRouter>
  );
}

describe("CustomerEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(customer);
    vi.mocked(domainApi.listCustomerEstablishments).mockResolvedValue({
      data: [
        {
          id: "link-1",
          customer_id: "customer-1",
          establishment_id: "est-1",
          contact_name: "Local Contact",
          email: "local@secpal.dev",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 1 },
    });
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "est-1", name: "Berlin" },
      { id: "est-2", name: "Hamburg" },
    ]);
    vi.mocked(customersApi.updateCustomer).mockResolvedValue(customer);
    vi.mocked(domainApi.updateCustomerEstablishment).mockResolvedValue({
      id: "link-1",
      customer_id: "customer-1",
      establishment_id: "est-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
  });

  it("loads local contacts into their establishment group", async () => {
    renderPage();
    expect(
      await screen.findByRole("textbox", { name: /local contact name 1/i })
    ).toHaveValue("Local Contact");
    expect(screen.getByRole("textbox", { name: /local email 1/i })).toHaveValue(
      "local@secpal.dev"
    );
    expect(screen.queryByText(/organizational unit/i)).not.toBeInTheDocument();
  });

  it("updates customer master data separately from the local assignment", async () => {
    const user = userEvent.setup();
    renderPage();
    const localContact = await screen.findByRole("textbox", {
      name: /local contact name 1/i,
    });
    await user.clear(localContact);
    await user.type(localContact, "Updated Local Contact");
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() =>
      expect(domainApi.updateCustomerEstablishment).toHaveBeenCalledWith(
        "link-1",
        expect.objectContaining({ contact_name: "Updated Local Contact" })
      )
    );
    expect(customersApi.updateCustomer).toHaveBeenCalledWith(
      "customer-1",
      expect.not.objectContaining({
        contact: expect.anything(),
        notes: expect.anything(),
      })
    );
    expect(navigate).toHaveBeenCalledWith("/customers/customer-1");
  });

  it("replaces an immutable assignment when its establishment changes", async () => {
    const user = userEvent.setup();
    vi.mocked(domainApi.deleteCustomerEstablishment).mockResolvedValue();
    vi.mocked(domainApi.createCustomerEstablishment).mockResolvedValue({
      id: "link-2",
      customer_id: "customer-1",
      establishment_id: "est-2",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    renderPage();

    await user.selectOptions(
      await screen.findByRole("combobox", { name: /^establishment 1/i }),
      "est-2"
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(domainApi.deleteCustomerEstablishment).toHaveBeenCalledWith(
        "link-1"
      )
    );
    expect(domainApi.createCustomerEstablishment).toHaveBeenCalledWith(
      expect.objectContaining({
        customer_id: "customer-1",
        establishment_id: "est-2",
      })
    );
    expect(domainApi.updateCustomerEstablishment).not.toHaveBeenCalled();
  });
});
