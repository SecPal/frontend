// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerCreate from "./CustomerCreate";
import * as customersApi from "../../services/customersApi";
import * as legalEntityApi from "../../services/customerLegalEntitiesApi";
import * as domainApi from "../../services/customerDomainApi";

vi.mock("../../services/customersApi");
vi.mock("../../services/customerLegalEntitiesApi");
vi.mock("../../services/customerDomainApi");
const navigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => navigate,
}));

function renderPage() {
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <CustomerCreate />
      </I18nProvider>
    </BrowserRouter>
  );
}

async function fillMasterData(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole("combobox", { name: /legal entity/i })
  );
  await user.click(await screen.findByRole("option", { name: "SecPal GmbH" }));
  await screen.findByRole("option", { name: "Berlin" });
  await user.type(screen.getByLabelText(/customer name/i), "ACME GmbH");
  await user.type(screen.getByLabelText(/street/i), "Main Street 1");
  await user.type(screen.getByLabelText(/postal code/i), "10115");
  await user.type(screen.getByLabelText(/city/i), "Berlin");
}

describe("CustomerCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockResolvedValue([
      { id: "legal-1", name: "SecPal GmbH" },
      { id: "legal-2", name: "SecPal Operations GmbH" },
    ]);
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "est-1", name: "Berlin" },
      { id: "est-2", name: "Hamburg" },
    ]);
    vi.mocked(customersApi.createCustomer).mockResolvedValue({
      id: "customer-1",
      customer_number: "KD-1",
      legal_entity_id: "legal-1",
      name: "ACME GmbH",
      billing_address: {
        street: "Main Street 1",
        postal_code: "10115",
        city: "Berlin",
        country: "DE",
      },
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
    vi.mocked(domainApi.createCustomerEstablishment).mockResolvedValue({
      id: "link-1",
      customer_id: "customer-1",
      establishment_id: "est-1",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });
  });

  it("auto-selects the sole legal entity and loads its establishments", async () => {
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockResolvedValue([
      { id: "legal-1", name: "SecPal GmbH" },
    ]);

    renderPage();

    await waitFor(() =>
      expect(domainApi.listEstablishmentLookups).toHaveBeenCalledWith("legal-1")
    );
    expect(
      await screen.findByRole("option", { name: "Berlin" })
    ).toBeInTheDocument();
  });

  it("exposes accessible master data and local establishment contacts without OU fields", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(
      await screen.findByRole("combobox", { name: /legal entity/i })
    );
    await user.click(
      await screen.findByRole("option", { name: "SecPal GmbH" })
    );
    await screen.findByRole("option", { name: "Berlin" });
    const group = await screen.findByRole("group", {
      name: /establishment 1/i,
    });
    expect(
      screen.getByRole("combobox", { name: /legal entity/i })
    ).toHaveAttribute("aria-required", "true");
    expect(
      within(group).getByRole("textbox", { name: /local contact name 1/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/organizational unit/i)).not.toBeInTheDocument();
  });

  it("creates one customer master record and multiple local contact assignments", async () => {
    const user = userEvent.setup();
    renderPage();
    await fillMasterData(user);
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^establishment 1/i }),
      "est-1"
    );
    await user.type(
      screen.getByRole("textbox", { name: /local contact name 1/i }),
      "Berlin Contact"
    );
    await user.click(
      screen.getByRole("button", { name: /add establishment/i })
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^establishment 2/i }),
      "est-2"
    );
    await user.type(
      screen.getByRole("textbox", { name: /local email 2/i }),
      "hamburg@secpal.dev"
    );
    await user.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() =>
      expect(domainApi.createCustomerEstablishment).toHaveBeenCalledTimes(2)
    );
    expect(customersApi.createCustomer).toHaveBeenCalledWith(
      expect.not.objectContaining({
        contact: expect.anything(),
        notes: expect.anything(),
      })
    );
    expect(domainApi.createCustomerEstablishment).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        customer_id: "customer-1",
        establishment_id: "est-1",
        contact_name: "Berlin Contact",
      })
    );
    expect(domainApi.createCustomerEstablishment).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        establishment_id: "est-2",
        email: "hamburg@secpal.dev",
      })
    );
    expect(navigate).toHaveBeenCalledWith("/customers/customer-1");
  });

  it("shows only the neutral duplicate message", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.createCustomer).mockRejectedValue(
      new Error("A matching record already exists.")
    );
    renderPage();
    await fillMasterData(user);
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^establishment 1/i }),
      "est-1"
    );
    await user.click(screen.getByRole("button", { name: /create customer/i }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("A matching record already exists.");
    expect(alert).not.toHaveTextContent(/existing customer|vat/i);
  });

  it("rolls back the customer master record when assignment creation fails", async () => {
    const user = userEvent.setup();
    vi.mocked(domainApi.createCustomerEstablishment).mockRejectedValue(
      new Error("Assignment failed")
    );
    vi.mocked(customersApi.deleteCustomer).mockResolvedValue();
    renderPage();
    await fillMasterData(user);
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^establishment 1/i }),
      "est-1"
    );
    await user.click(screen.getByRole("button", { name: /create customer/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Assignment failed"
    );
    expect(customersApi.deleteCustomer).toHaveBeenCalledWith("customer-1");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("navigates to recovery editing when customer rollback also fails", async () => {
    const user = userEvent.setup();
    vi.mocked(domainApi.createCustomerEstablishment).mockRejectedValue(
      new Error("Assignment failed")
    );
    vi.mocked(customersApi.deleteCustomer).mockRejectedValue(
      new Error("Rollback failed")
    );
    renderPage();
    await fillMasterData(user);
    await user.selectOptions(
      screen.getByRole("combobox", { name: /^establishment 1/i }),
      "est-1"
    );
    await user.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith(
        "/customers/customer-1/edit",
        expect.objectContaining({ state: expect.any(Object) })
      )
    );
  });
});
