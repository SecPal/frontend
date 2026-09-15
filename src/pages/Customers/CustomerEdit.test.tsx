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

vi.mock("../../services/customersApi", async (importOriginal) => {
  const actual = await importOriginal<typeof customersApi>();
  return {
    ...actual,
    getCustomerEditSnapshot: vi.fn(),
    transactionallyEditCustomer: vi.fn(),
    updateCustomer: vi.fn(),
  };
});
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

const customerB: Customer = {
  ...customer,
  id: "customer-2",
  customer_number: "KD-2",
  name: "Customer B",
  customer_establishments: customer.customer_establishments.map(
    (assignment) => ({ ...assignment, customer_id: "customer-2" })
  ),
};

function snapshot(value: Customer = customer, etag = '"customer-v1"') {
  return { customer: value, etag };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject, resolve };
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
    vi.resetAllMocks();
    vi.mocked(customersApi.getCustomerEditSnapshot).mockResolvedValue(
      snapshot()
    );
    vi.mocked(customersApi.transactionallyEditCustomer).mockResolvedValue(
      customer
    );
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "est-1", name: "Berlin" },
      { id: "est-2", name: "Hamburg" },
      { id: "est-3", name: "Munich" },
      { id: "est-4", name: "Cologne" },
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
    expect(navigate).toHaveBeenCalledWith("/customers/customer-1", {
      state: { committedCustomer: customer },
    });
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

  it("reconciles actual edits onto a refreshed baseline before explicit stale retry", async () => {
    const user = userEvent.setup();
    const refreshedSnapshot = deferred<ReturnType<typeof snapshot>>();
    const originalCustomer: Customer = {
      ...customer,
      customer_establishments: [
        customer.customer_establishments[0]!,
        {
          ...customer.customer_establishments[0]!,
          id: "link-2",
          establishment_id: "est-2",
          contact_name: "Original Second Contact",
        },
      ],
    };
    const currentCustomer: Customer = {
      ...originalCustomer,
      legal_entity_id: "legal-2",
      billing_address: {
        ...originalCustomer.billing_address,
        city: "Munich",
      },
      customer_establishments: [
        {
          ...originalCustomer.customer_establishments[0]!,
          establishment_id: "est-3",
          contact_name: "Server Changed Contact",
        },
        {
          ...originalCustomer.customer_establishments[1]!,
          contact_name: "Server Changed Second Contact",
        },
      ],
    };
    vi.mocked(customersApi.getCustomerEditSnapshot)
      .mockResolvedValueOnce(snapshot(originalCustomer))
      .mockImplementationOnce(() => refreshedSnapshot.promise);
    vi.mocked(domainApi.listEstablishmentLookups)
      .mockResolvedValueOnce([
        { id: "est-1", name: "Berlin" },
        { id: "est-2", name: "Hamburg" },
        { id: "est-4", name: "Cologne" },
      ])
      .mockRejectedValueOnce(new Error("New entity lookups failed"))
      .mockResolvedValueOnce([
        { id: "est-2", name: "New Hamburg" },
        { id: "est-3", name: "New Munich" },
        { id: "est-4", name: "New Cologne" },
      ]);
    vi.mocked(customersApi.transactionallyEditCustomer)
      .mockRejectedValueOnce(
        new customersApi.CustomerTransactionalEditError(
          "The customer changed while you were editing.",
          412,
          "CUSTOMER_EDIT_STALE"
        )
      )
      .mockResolvedValueOnce(currentCustomer);
    renderPage();

    const name = await screen.findByLabelText(/customer name/i);
    await user.clear(name);
    await user.type(name, "My Intended Customer Name");
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^establishment 2/i }),
      "est-4"
    );
    const secondContact = screen.getByRole("textbox", {
      name: /local contact name 2/i,
    });
    const firstContact = screen.getByRole("textbox", {
      name: /local contact name 1/i,
    });
    await user.type(firstContact, "  ");
    await user.clear(secondContact);
    await user.type(secondContact, "My Intended Second Contact");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledWith(
      "customer-1",
      '"customer-v1"',
      expect.objectContaining({
        customer_establishments: expect.arrayContaining([
          expect.objectContaining({ contact_name: "Local Contact" }),
        ]),
      })
    );

    await waitFor(() =>
      expect(customersApi.getCustomerEditSnapshot).toHaveBeenCalledTimes(2)
    );
    expect(name).toBeDisabled();
    expect(firstContact).toBeDisabled();
    expect(
      screen.getByRole("combobox", { name: /^establishment 2/i })
    ).toBeDisabled();
    await user.type(name, "must not be accepted");
    expect(name).toHaveValue("My Intended Customer Name");

    await act(async () => {
      refreshedSnapshot.resolve(snapshot(currentCustomer, '"customer-v2"'));
      await refreshedSnapshot.promise;
    });

    const lookupAlert = (
      await screen.findByText("Some establishment details could not be loaded.")
    ).closest('[role="alert"]');
    expect(lookupAlert).not.toBeNull();
    expect(lookupAlert).toHaveTextContent(
      "Some establishment details could not be loaded."
    );
    expect(
      screen.getByRole("button", { name: /save changes/i })
    ).toBeDisabled();
    expect(domainApi.listEstablishmentLookups).toHaveBeenLastCalledWith(
      "legal-2"
    );
    await user.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() =>
      expect(
        screen.queryByText("Some establishment details could not be loaded.")
      ).not.toBeInTheDocument()
    );

    const restore = screen.getByRole("button", {
      name: /restore my changes/i,
    });
    expect(
      restore.closest('[data-slot="alert-description"]')
    ).not.toBeInTheDocument();
    expect(domainApi.listEstablishmentLookups).toHaveBeenLastCalledWith(
      "legal-2"
    );
    expect(name).toHaveValue("ACME GmbH");
    expect(screen.getByLabelText(/city/i)).toHaveValue("Munich");
    expect(
      screen.getByRole("textbox", { name: /local contact name 1/i })
    ).toHaveValue("Server Changed Contact");
    expect(
      screen.getByRole("combobox", { name: /^establishment 1/i })
    ).toHaveValue("est-3");
    expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledTimes(1);

    await user.click(restore);
    const restoreButton = screen.queryByRole("button", {
      name: /restore my changes/i,
    });
    expect(restoreButton).not.toBeInTheDocument();
    expect(name).toHaveValue("My Intended Customer Name");
    expect(screen.getByLabelText(/city/i)).toHaveValue("Munich");
    expect(
      screen.getByRole("combobox", { name: /^establishment 1/i })
    ).toHaveValue("est-3");
    expect(
      screen.getByRole("textbox", { name: /local contact name 1/i })
    ).toHaveValue("Server Changed Contact");
    expect(
      screen.getByRole("combobox", { name: /^establishment 2/i })
    ).toHaveValue("est-4");
    expect(secondContact).toHaveValue("My Intended Second Contact");
    expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: /save changes/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
    expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledTimes(2);
    expect(customersApi.transactionallyEditCustomer).toHaveBeenLastCalledWith(
      "customer-1",
      '"customer-v2"',
      expect.objectContaining({
        customer: expect.objectContaining({
          name: "My Intended Customer Name",
          billing_address: expect.objectContaining({ city: "Munich" }),
        }),
        customer_establishments: [
          expect.objectContaining({
            establishment_id: "est-3",
            contact_name: "Server Changed Contact",
          }),
          expect.objectContaining({
            establishment_id: "est-4",
            contact_name: "My Intended Second Contact",
          }),
        ],
      })
    );
    expectNoLegacyWrites();
  });

  it("invalidates an earlier restore intent when a later stale refresh fails", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomerEditSnapshot)
      .mockResolvedValueOnce(snapshot())
      .mockResolvedValueOnce(snapshot(customer, '"customer-v2"'))
      .mockRejectedValueOnce(new Error("Refresh failed"));
    vi.mocked(customersApi.transactionallyEditCustomer).mockRejectedValue(
      new customersApi.CustomerTransactionalEditError(
        "The customer changed while you were editing.",
        412,
        "CUSTOMER_EDIT_STALE"
      )
    );
    renderPage();

    const save = await screen.findByRole("button", { name: /save changes/i });
    await user.click(save);
    expect(
      await screen.findByRole("button", { name: /restore my changes/i })
    ).toBeVisible();

    await user.click(save);
    expect(
      await screen.findByText(/latest customer data could not be loaded/i)
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /restore my changes/i })
    ).not.toBeInTheDocument();
    expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledTimes(2);
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
    const retry = screen.getByRole("button", { name: /retry/i });
    expect(
      partialLoadAlert.querySelector('[data-slot="alert-description"] button')
    ).toBeNull();

    await user.click(retry);
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

  it("ignores a successful save after leaving and returning to its customer route", async () => {
    const user = userEvent.setup();
    const save = deferred<Customer>();
    vi.mocked(customersApi.getCustomerEditSnapshot).mockImplementation(
      async (customerId) =>
        customerId === "customer-1"
          ? snapshot(customer, '"customer-a"')
          : snapshot(customerB, '"customer-b"')
    );
    vi.mocked(customersApi.transactionallyEditCustomer).mockImplementation(
      () => save.promise
    );
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: /save changes/i })
    );
    await waitFor(() =>
      expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledTimes(1)
    );

    act(() => {
      window.history.pushState({}, "", "/customers/customer-2/edit");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(await screen.findByLabelText(/customer name/i)).toHaveValue(
      "Customer B"
    );
    act(() => {
      window.history.pushState({}, "", "/customers/customer-1/edit");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(await screen.findByLabelText(/customer name/i)).toHaveValue(
      "ACME GmbH"
    );

    await act(async () => {
      save.resolve(customer);
      await save.promise;
    });

    expect(navigate).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/customer name/i)).toHaveValue("ACME GmbH");
  });

  it("ignores a failed save after leaving and returning to its customer route", async () => {
    const user = userEvent.setup();
    const previousSave = deferred<Customer>();
    const currentSave = deferred<Customer>();
    vi.mocked(customersApi.getCustomerEditSnapshot).mockImplementation(
      async (customerId) =>
        customerId === "customer-1"
          ? snapshot(customer, '"customer-a"')
          : snapshot(customerB, '"customer-b"')
    );
    vi.mocked(customersApi.transactionallyEditCustomer)
      .mockImplementationOnce(() => previousSave.promise)
      .mockImplementationOnce(() => currentSave.promise);
    renderPage();

    await user.click(
      await screen.findByRole("button", { name: /save changes/i })
    );
    await waitFor(() =>
      expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledTimes(1)
    );

    act(() => {
      window.history.pushState({}, "", "/customers/customer-2/edit");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(await screen.findByLabelText(/customer name/i)).toHaveValue(
      "Customer B"
    );
    act(() => {
      window.history.pushState({}, "", "/customers/customer-1/edit");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    const save = await screen.findByRole("button", { name: /save changes/i });
    await user.click(save);
    await waitFor(() =>
      expect(customersApi.transactionallyEditCustomer).toHaveBeenCalledTimes(2)
    );

    await act(async () => {
      previousSave.reject(new Error("Previous route failed"));
      await previousSave.promise.catch(() => undefined);
    });

    expect(screen.queryByText("Previous route failed")).not.toBeInTheDocument();
    expect(save).toBeDisabled();

    await act(async () => {
      currentSave.reject(new Error("Current route failed"));
      await currentSave.promise.catch(() => undefined);
    });
    expect(await screen.findByText("Current route failed")).toBeVisible();
    expect(save).toBeEnabled();
    expect(navigate).not.toHaveBeenCalled();
  });
});
