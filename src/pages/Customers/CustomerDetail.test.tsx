// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import CustomerDetail from "./CustomerDetail";
import * as customersApi from "../../services/customersApi";
import * as domainApi from "../../services/customerDomainApi";

vi.mock("../../services/customersApi");
vi.mock("../../services/customerDomainApi");
const { mockUseUserCapabilities } = vi.hoisted(() => ({
  mockUseUserCapabilities: vi.fn(),
}));
vi.mock("../../hooks/useUserCapabilities", () => ({
  useUserCapabilities: mockUseUserCapabilities,
}));
const navigate = vi.fn();
vi.mock("react-router-dom", async () => ({
  ...(await vi.importActual("react-router-dom")),
  useNavigate: () => navigate,
}));

function renderPage(path = "/customers/customer-1") {
  window.history.pushState({}, "", path);
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
    mockUseUserCapabilities.mockReturnValue({
      actions: { customers: { update: true, delete: true } },
    });
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

  it("opens, cancels, and confirms the destructive flow", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.deleteCustomer).mockResolvedValue();
    renderPage();
    await screen.findByRole("heading", { name: "ACME GmbH" });

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(customersApi.deleteCustomer).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    await user.click(
      within(await screen.findByRole("dialog")).getByRole("button", {
        name: /^delete$/i,
      })
    );
    await waitFor(() =>
      expect(customersApi.deleteCustomer).toHaveBeenCalledWith("customer-1")
    );
    expect(navigate).toHaveBeenCalledWith("/customers");
  });

  it("keeps the delete dialog open and reports a deletion error", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.deleteCustomer).mockRejectedValue(
      new Error("Customer has active sites")
    );
    renderPage();
    await screen.findByRole("heading", { name: "ACME GmbH" });
    await user.click(screen.getByRole("button", { name: /^delete$/i }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Customer has active sites"
    );
    expect(navigate).not.toHaveBeenCalled();
  });

  it("hides management actions without customer capabilities", async () => {
    mockUseUserCapabilities.mockReturnValue({
      actions: { customers: { update: false, delete: false } },
    });
    renderPage();
    await screen.findByRole("heading", { name: "ACME GmbH" });

    expect(
      screen.queryByRole("link", { name: /^edit$/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^delete$/i })
    ).not.toBeInTheDocument();
  });

  it("ignores a late response after navigating to another customer", async () => {
    const customerA = {
      ...(await vi.mocked(customersApi.getCustomer)("customer-1")),
      id: "customer-A",
      name: "Customer A",
      customer_number: "KD-A",
    };
    const customerB = {
      ...customerA,
      id: "customer-B",
      name: "Customer B",
      customer_number: "KD-B",
    };
    let resolveCustomerA: ((value: typeof customerA) => void) | undefined;
    vi.mocked(customersApi.getCustomer).mockImplementation(async (id) => {
      if (id === "customer-A") {
        return new Promise((resolve) => {
          resolveCustomerA = resolve;
        });
      }
      return customerB;
    });

    renderPage("/customers/customer-A");
    await act(async () => {
      window.history.pushState({}, "", "/customers/customer-B");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    expect(await screen.findByText("Customer B")).toBeInTheDocument();

    await act(async () => {
      resolveCustomerA?.(customerA);
    });
    expect(screen.queryByText("Customer A")).not.toBeInTheDocument();
    expect(screen.getByText("Customer B")).toBeInTheDocument();
  });
});
