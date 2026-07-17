// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerEdit from "./CustomerEdit";
import * as customersApi from "../../services/customersApi";
import * as domainApi from "../../services/customerDomainApi";
import * as legalEntityApi from "../../services/customerLegalEntitiesApi";

vi.mock("../../services/customersApi");
vi.mock("../../services/customerDomainApi");
vi.mock("../../services/customerLegalEntitiesApi");
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
  customer_establishments: [],
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
    vi.mocked(domainApi.listAllCustomerEstablishments).mockResolvedValue([
      {
        id: "link-1",
        customer_id: "customer-1",
        establishment_id: "est-1",
        contact_name: "Local Contact",
        email: "local@secpal.dev",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "est-1", name: "Berlin" },
      { id: "est-2", name: "Hamburg" },
    ]);
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockResolvedValue([
      { id: "legal-1", name: "SecPal GmbH" },
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
    expect(await screen.findByText(/SecPal GmbH/)).toBeInTheDocument();
    expect(
      screen.queryByText(/Legal Entity:\s*legal-1/)
    ).not.toBeInTheDocument();
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
    expect(
      vi.mocked(domainApi.createCustomerEstablishment).mock
        .invocationCallOrder[0]
    ).toBeLessThan(
      vi.mocked(domainApi.deleteCustomerEstablishment).mock
        .invocationCallOrder[0]!
    );
  });

  it("keeps the original assignment when replacement creation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(domainApi.createCustomerEstablishment).mockRejectedValue(
      new Error("Replacement failed")
    );
    renderPage();

    await user.selectOptions(
      await screen.findByRole("combobox", { name: /^establishment 1/i }),
      "est-2"
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Replacement failed"
    );
    expect(domainApi.deleteCustomerEstablishment).not.toHaveBeenCalled();
  });

  it("does not start assignment writes when the master update fails", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.updateCustomer).mockRejectedValue(
      new Error("Master update failed")
    );
    renderPage();

    await screen.findByLabelText(/customer name/i);
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Master update failed")).toBeVisible();
    expect(domainApi.updateCustomerEstablishment).not.toHaveBeenCalled();
    expect(domainApi.createCustomerEstablishment).not.toHaveBeenCalled();
    expect(domainApi.deleteCustomerEstablishment).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("restores customer master data when assignment reconciliation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(domainApi.createCustomerEstablishment).mockRejectedValue(
      new Error("Assignment failed")
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

    expect(await screen.findByText("Assignment failed")).toBeVisible();
    expect(customersApi.updateCustomer).toHaveBeenCalledTimes(2);
    expect(customersApi.updateCustomer).toHaveBeenNthCalledWith(
      2,
      "customer-1",
      expect.objectContaining({
        name: "ACME GmbH",
        billing_address: customer.billing_address,
        is_active: true,
      })
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("requires a reload when customer master recovery fails", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.updateCustomer)
      .mockResolvedValueOnce(customer)
      .mockRejectedValueOnce(new Error("Master recovery failed"));
    vi.mocked(domainApi.createCustomerEstablishment).mockRejectedValue(
      new Error("Assignment failed")
    );
    renderPage();

    await user.selectOptions(
      await screen.findByRole("combobox", { name: /^establishment 1/i }),
      "est-2"
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText(
        /customer data could not be fully restored.*reload the page/i
      )
    ).toBeVisible();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("restores earlier contact updates when a later contact update fails", async () => {
    const user = userEvent.setup();
    vi.mocked(domainApi.listAllCustomerEstablishments).mockResolvedValue([
      {
        id: "link-1",
        customer_id: "customer-1",
        establishment_id: "est-1",
        contact_name: "Berlin Contact",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "link-2",
        customer_id: "customer-1",
        establishment_id: "est-2",
        contact_name: "Hamburg Contact",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    vi.mocked(domainApi.updateCustomerEstablishment)
      .mockResolvedValueOnce({
        id: "link-1",
        customer_id: "customer-1",
        establishment_id: "est-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      })
      .mockRejectedValueOnce(new Error("Second contact failed"))
      .mockResolvedValueOnce({
        id: "link-1",
        customer_id: "customer-1",
        establishment_id: "est-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      });
    renderPage();

    const firstContact = await screen.findByRole("textbox", {
      name: /local contact name 1/i,
    });
    await user.clear(firstContact);
    await user.type(firstContact, "Changed Berlin Contact");
    const secondContact = screen.getByRole("textbox", {
      name: /local contact name 2/i,
    });
    await user.clear(secondContact);
    await user.type(secondContact, "Changed Hamburg Contact");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Second contact failed")).toBeVisible();
    expect(domainApi.updateCustomerEstablishment).toHaveBeenCalledTimes(3);
    expect(domainApi.updateCustomerEstablishment).toHaveBeenNthCalledWith(
      3,
      "link-1",
      expect.objectContaining({ contact_name: "Berlin Contact" })
    );
    expect(customersApi.updateCustomer).toHaveBeenCalledTimes(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("requires a reload when an earlier contact update cannot be restored", async () => {
    const user = userEvent.setup();
    vi.mocked(domainApi.listAllCustomerEstablishments).mockResolvedValue([
      {
        id: "link-1",
        customer_id: "customer-1",
        establishment_id: "est-1",
        contact_name: "Berlin Contact",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "link-2",
        customer_id: "customer-1",
        establishment_id: "est-2",
        contact_name: "Hamburg Contact",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    vi.mocked(domainApi.updateCustomerEstablishment)
      .mockResolvedValueOnce({
        id: "link-1",
        customer_id: "customer-1",
        establishment_id: "est-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      })
      .mockRejectedValueOnce(new Error("Second contact failed"))
      .mockRejectedValueOnce(new Error("Contact recovery failed"));
    renderPage();

    await screen.findByRole("textbox", { name: /local contact name 1/i });
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(
      await screen.findByText(
        /establishment assignments could not be fully restored.*reload the page/i
      )
    ).toBeVisible();
    expect(customersApi.updateCustomer).toHaveBeenCalledTimes(2);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("frees occupied establishments before swapping assignments", async () => {
    const user = userEvent.setup();
    vi.mocked(domainApi.listAllCustomerEstablishments).mockResolvedValue([
      {
        id: "link-1",
        customer_id: "customer-1",
        establishment_id: "est-1",
        contact_name: "Berlin Contact",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "link-2",
        customer_id: "customer-1",
        establishment_id: "est-2",
        contact_name: "Hamburg Contact",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    vi.mocked(domainApi.deleteCustomerEstablishment).mockResolvedValue();
    vi.mocked(domainApi.createCustomerEstablishment).mockImplementation(
      async (request) => ({
        id: request.establishment_id === "est-1" ? "link-1" : "link-2",
        customer_id: "customer-1",
        establishment_id: request.establishment_id,
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      })
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

    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(domainApi.deleteCustomerEstablishment).toHaveBeenCalledTimes(2);
    expect(domainApi.createCustomerEstablishment).toHaveBeenCalledTimes(2);
    expect(
      vi.mocked(domainApi.deleteCustomerEstablishment).mock
        .invocationCallOrder[1]
    ).toBeLessThan(
      vi.mocked(domainApi.createCustomerEstablishment).mock
        .invocationCallOrder[0]!
    );
  });

  it("restores original assignments when a swap creation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(domainApi.listAllCustomerEstablishments).mockResolvedValue([
      {
        id: "link-1",
        customer_id: "customer-1",
        establishment_id: "est-1",
        contact_name: "Berlin Contact",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
      {
        id: "link-2",
        customer_id: "customer-1",
        establishment_id: "est-2",
        contact_name: "Hamburg Contact",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      },
    ]);
    vi.mocked(domainApi.deleteCustomerEstablishment).mockResolvedValue();
    vi.mocked(domainApi.createCustomerEstablishment)
      .mockResolvedValueOnce({
        id: "link-2",
        customer_id: "customer-1",
        establishment_id: "est-2",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      })
      .mockRejectedValueOnce(new Error("Second replacement failed"))
      .mockResolvedValueOnce({
        id: "link-1",
        customer_id: "customer-1",
        establishment_id: "est-1",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-01T00:00:00Z",
      })
      .mockResolvedValueOnce({
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
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^establishment 2/i }),
      "est-1"
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(await screen.findByText("Second replacement failed")).toBeVisible();
    expect(domainApi.createCustomerEstablishment).toHaveBeenCalledTimes(4);
    expect(domainApi.createCustomerEstablishment).toHaveBeenNthCalledWith(
      3,
      expect.objectContaining({ establishment_id: "est-1" })
    );
    expect(domainApi.createCustomerEstablishment).toHaveBeenNthCalledWith(
      4,
      expect.objectContaining({ establishment_id: "est-2" })
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("shows the new route error when a customer route transition fails", async () => {
    vi.mocked(customersApi.getCustomer).mockImplementation(async (id) => {
      if (id === "customer-1") return customer;
      throw new Error("Customer 2 failed to load");
    });
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
