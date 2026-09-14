// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerEdit from "./CustomerEdit";
import * as customersApi from "../../services/customersApi";
import * as domainApi from "../../services/customerDomainApi";
import * as legalEntityApi from "../../services/customerLegalEntitiesApi";
import type { Customer } from "@/types/api/customers";

vi.mock("../../services/customersApi");
vi.mock("../../services/customerDomainApi");
vi.mock("../../services/customerLegalEntitiesApi");
const navigate = vi.fn();
vi.mock("react-router", async () => ({
  ...(await vi.importActual("react-router")),
  useNavigate: () => navigate,
}));

const customer: Customer = {
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
  customer_establishments: [
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
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

function snapshot(value: Customer = customer, etag = '"customer-v1"') {
  return { customer: value, etag };
}

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

function expectNoLegacyWrites() {
  expect(customersApi.updateCustomer).not.toHaveBeenCalled();
  expect(domainApi.updateCustomerEstablishment).not.toHaveBeenCalled();
  expect(domainApi.createCustomerEstablishment).not.toHaveBeenCalled();
  expect(domainApi.deleteCustomerEstablishment).not.toHaveBeenCalled();
}

describe("CustomerEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(customersApi.getCustomerEditSnapshot).mockResolvedValue(
      snapshot()
    );
    vi.mocked(customersApi.transactionallyEditCustomer).mockResolvedValue(
      customer
    );
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "est-1", name: "Berlin" },
      { id: "est-2", name: "Hamburg" },
    ]);
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockResolvedValue([
      { id: "legal-1", name: "SecPal GmbH" },
    ]);
  });

  it("loads the complete customer snapshot into the edit form", async () => {
    renderPage();

    expect(
      await screen.findByRole("textbox", { name: /local contact name 1/i })
    ).toHaveValue("Local Contact");
    expect(screen.getByRole("textbox", { name: /local email 1/i })).toHaveValue(
      "local@secpal.dev"
    );
    expect(customersApi.getCustomerEditSnapshot).toHaveBeenCalledWith(
      "customer-1"
    );
    expect(domainApi.listAllCustomerEstablishments).not.toHaveBeenCalled();
    expect(await screen.findByText(/SecPal GmbH/)).toBeInTheDocument();
  });

  it("submits master data and the complete desired assignments atomically", async () => {
    const user = userEvent.setup();
    renderPage();

    const name = await screen.findByLabelText(/customer name/i);
    await user.clear(name);
    await user.type(name, "Updated ACME GmbH");
    const localContact = screen.getByRole("textbox", {
      name: /local contact name 1/i,
    });
    await user.clear(localContact);
    await user.type(localContact, "Updated Local Contact");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledWith(
        "customer-1",
        '"customer-v1"',
        {
          customer: {
            name: "Updated ACME GmbH",
            vat_id: null,
            billing_address: customer.billing_address,
            is_active: true,
          },
          customer_establishments: [
            {
              customer_id: "customer-1",
              establishment_id: "est-1",
              contact_name: "Updated Local Contact",
              email: "local@secpal.dev",
              phone: null,
              comments: null,
            },
          ],
        }
      )
    );
    expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledTimes(1);
    expectNoLegacyWrites();
    expect(navigate).toHaveBeenCalledWith("/customers/customer-1");
  });

  it("keeps the edited snapshot intact when the atomic request fails", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.transactionallyEditCustomer).mockRejectedValue(
      new Error("The customer edit conflicts with the current resource state.")
    );
    renderPage();

    const name = await screen.findByLabelText(/customer name/i);
    await user.clear(name);
    await user.type(name, "Changed Customer");
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^establishment 1/i }),
      "est-2"
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText(
        "The customer edit conflicts with the current resource state."
      )
    ).toBeVisible();
    expect(name).toHaveValue("Changed Customer");
    expect(
      screen.getByRole("combobox", { name: /^establishment 1/i })
    ).toHaveValue("est-2");
    expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledTimes(1);
    expectNoLegacyWrites();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("sends a swap cycle as one complete desired snapshot", async () => {
    const user = userEvent.setup();
    const twoAssignments = {
      ...customer,
      customer_establishments: [
        customer.customer_establishments[0]!,
        {
          id: "link-2",
          customer_id: "customer-1",
          establishment_id: "est-2",
          contact_name: "Hamburg Contact",
          created_at: "2026-01-01T00:00:00Z",
          updated_at: "2026-01-01T00:00:00Z",
        },
      ],
    };
    vi.mocked(customersApi.getCustomerEditSnapshot).mockResolvedValue(
      snapshot(twoAssignments)
    );
    renderPage();

    await user.selectOptions(
      await screen.findByRole("combobox", { name: /^establishment 1/i }),
      "est-2"
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^establishment 2/i }),
      "est-1"
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() =>
      expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledWith(
        "customer-1",
        '"customer-v1"',
        expect.objectContaining({
          customer_establishments: [
            expect.objectContaining({ establishment_id: "est-2" }),
            expect.objectContaining({ establishment_id: "est-1" }),
          ],
        })
      )
    );
    expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledTimes(1);
    expectNoLegacyWrites();
  });

  it("shows authorization drift as a save error without compensating writes", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.transactionallyEditCustomer).mockRejectedValue(
      new Error("Insufficient permissions")
    );
    renderPage();

    await screen.findByLabelText(/customer name/i);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Insufficient permissions")).toBeVisible();
    expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledTimes(1);
    expectNoLegacyWrites();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("retries the same atomic edit after a transient failure", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.transactionallyEditCustomer)
      .mockRejectedValueOnce(new Error("Temporary failure"))
      .mockResolvedValueOnce(customer);
    renderPage();

    await screen.findByLabelText(/customer name/i);
    const save = screen.getByRole("button", { name: /save changes/i });
    await user.click(save);
    expect(await screen.findByText("Temporary failure")).toBeVisible();

    await user.click(save);
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(customersApi.transactionallyEditCustomer).mock.calls[1]
    ).toEqual(
      vi.mocked(customersApi.transactionallyEditCustomer).mock.calls[0]
    );
    expectNoLegacyWrites();
  });

  it("keeps partial lookup failures separate from later save errors", async () => {
    const user = userEvent.setup();
    vi.mocked(domainApi.listEstablishmentLookups)
      .mockRejectedValueOnce(new Error("Lookup failed"))
      .mockResolvedValueOnce([
        { id: "est-1", name: "Berlin" },
        { id: "est-2", name: "Hamburg" },
      ]);
    vi.mocked(customersApi.transactionallyEditCustomer).mockRejectedValue(
      new Error("Save failed")
    );
    renderPage();

    expect(await screen.findByLabelText(/customer name/i)).toBeVisible();
    const partialLoadAlert = await screen.findByRole("alert");
    expect(partialLoadAlert).toHaveTextContent(
      "Some establishment details could not be loaded."
    );
    expect(
      screen.getByRole("button", { name: /save changes/i })
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() =>
      expect(
        screen.queryByText("Some establishment details could not be loaded.")
      ).not.toBeInTheDocument()
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Save failed")).toBeVisible();
    expect(
      screen.queryByText("Some establishment details could not be loaded.")
    ).not.toBeInTheDocument();
  });

  it("shows the new route error when a customer route transition fails", async () => {
    vi.mocked(customersApi.getCustomerEditSnapshot).mockImplementation(
      async (id) => {
        if (id === "customer-1") return snapshot();
        throw new Error("Customer 2 failed to load");
      }
    );
    renderPage();
    expect(
      await screen.findByRole("textbox", { name: /local contact name 1/i })
    ).toBeInTheDocument();

    act(() => {
      window.history.pushState({}, "", "/customers/customer-2/edit");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Customer 2 failed to load"
    );
    expect(
      screen.queryByRole("textbox", { name: /local contact name 1/i })
    ).not.toBeInTheDocument();
  });
});
