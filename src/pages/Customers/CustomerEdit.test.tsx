// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import CustomerEdit from "./CustomerEdit";
import * as customerLegalEntitiesApi from "../../services/customerLegalEntitiesApi";
import * as customersApi from "../../services/customersApi";

const { mockUseUserCapabilities } = vi.hoisted(() => ({
  mockUseUserCapabilities: vi.fn(),
}));

vi.mock("../../services/customersApi");
vi.mock("../../services/customerLegalEntitiesApi");
vi.mock("../../hooks/useUserCapabilities", () => ({
  useUserCapabilities: mockUseUserCapabilities,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Renders CustomerEdit with mocked router context
function renderWithRouter() {
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <Routes>
          <Route path="/customers/:id/edit" element={<CustomerEdit />} />
        </Routes>
      </I18nProvider>
    </BrowserRouter>,
    { wrapper: undefined }
  );
}

describe("CustomerEdit", () => {
  const mockCustomer = {
    id: "customer-123",
    name: "Existing Customer",
    customer_number: "CUST-2025-001",
    legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
    vat_id: "DE123456789",
    billing_address: {
      street: "Old Street 10",
      city: "Old City",
      postal_code: "54321",
      country: "DE",
    },
    establishment_relationships: [],
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(
      customerLegalEntitiesApi.listCustomerLegalEntities
    ).mockResolvedValue([
      {
        id: mockCustomer.legal_entity_id,
        name: "SecPal GmbH",
      },
    ]);
    window.history.pushState({}, "", "/customers/customer-123/edit");
    mockUseUserCapabilities.mockReturnValue({
      actions: {
        customers: { create: true, update: true, delete: true },
      },
    });
    vi.mocked(customersApi.listCustomerEstablishmentOptions).mockResolvedValue([
      { id: "establishment-456", name: "Hamburg Establishment" },
    ]);
  });

  it("loads and displays customer data", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(customersApi.getCustomer).toHaveBeenCalledWith("customer-123");
    });

    expect(await screen.findByLabelText(/customer name/i)).toHaveValue(
      "Existing Customer"
    );
    expect(screen.getByLabelText(/street/i)).toHaveValue("Old Street 10");
    expect(screen.getByLabelText(/city/i)).toHaveValue("Old City");
    expect(screen.getByLabelText(/postal code/i)).toHaveValue("54321");
    expect(screen.getByLabelText(/country/i)).toHaveValue("DE");
    expect(
      within(
        screen.getByRole("form", { name: /customer master data/i })
      ).queryByLabelText(/notes/i)
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/vat id/i)).toHaveValue("DE123456789");
  });

  it("blocks an unmigrated customer until an authorized legal entity is explicitly selected", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue({
      ...mockCustomer,
      legal_entity_id: undefined,
    } as unknown as typeof mockCustomer);

    renderWithRouter();

    expect(
      await screen.findByText(/requires a legal entity assignment/i)
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /save changes/i }));
    expect(
      await screen.findByText(/legal entity must be selected/i)
    ).toBeInTheDocument();
    expect(customersApi.updateCustomer).not.toHaveBeenCalled();
  });

  it("assigns an unmigrated customer only after selecting a tenant-authorized legal entity", async () => {
    const user = userEvent.setup();
    const legalEntity = {
      id: "550e8400-e29b-41d4-a716-446655440002",
      name: "SecPal Operations GmbH",
    };
    vi.mocked(
      customerLegalEntitiesApi.listCustomerLegalEntities
    ).mockResolvedValue([legalEntity]);
    vi.mocked(customersApi.getCustomer).mockResolvedValue({
      ...mockCustomer,
      legal_entity_id: undefined,
    } as unknown as typeof mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockResolvedValue({
      ...mockCustomer,
      legal_entity_id: legalEntity.id,
    });

    renderWithRouter();

    const legalEntitySelect = await screen.findByRole("combobox", {
      name: /legal entity/i,
    });
    await user.click(legalEntitySelect);
    await user.click(
      await screen.findByRole("option", { name: legalEntity.name })
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(customersApi.updateCustomer).toHaveBeenCalledWith(
        "customer-123",
        expect.objectContaining({ legal_entity_id: legalEntity.id })
      );
    });
  });

  it("recovers an unmigrated customer after a legal entity lookup failure", async () => {
    const user = userEvent.setup();
    const legalEntity = {
      id: "550e8400-e29b-41d4-a716-446655440002",
      name: "SecPal Operations GmbH",
    };
    vi.mocked(customersApi.getCustomer).mockResolvedValue({
      ...mockCustomer,
      legal_entity_id: undefined,
    } as unknown as typeof mockCustomer);
    vi.mocked(customerLegalEntitiesApi.listCustomerLegalEntities)
      .mockRejectedValueOnce(new Error("Legal entity lookup failed"))
      .mockResolvedValueOnce([legalEntity]);
    vi.mocked(customersApi.updateCustomer).mockResolvedValue({
      ...mockCustomer,
      name: "Edited before retry",
      legal_entity_id: legalEntity.id,
    });

    renderWithRouter();

    const customerName = await screen.findByLabelText(/customer name/i);
    await user.clear(customerName);
    await user.type(customerName, "Edited before retry");

    const lookupError = await screen.findByRole("alert");
    expect(lookupError).toHaveTextContent("Legal entity lookup failed");

    const legalEntitySelect = screen.getByRole("combobox", {
      name: /legal entity/i,
    });
    expect(legalEntitySelect).toBeDisabled();
    expect(legalEntitySelect).toHaveAttribute(
      "aria-describedby",
      "customer-legal-entity-lookup-error"
    );

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(
        customerLegalEntitiesApi.listCustomerLegalEntities
      ).toHaveBeenCalledTimes(2);
      expect(legalEntitySelect).toBeEnabled();
    });
    expect(customerName).toHaveValue("Edited before retry");

    await user.click(legalEntitySelect);
    await user.click(
      await screen.findByRole("option", { name: legalEntity.name })
    );
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(customersApi.updateCustomer).toHaveBeenCalledWith(
        "customer-123",
        expect.objectContaining({
          name: "Edited before retry",
          legal_entity_id: legalEntity.id,
        })
      );
    });
  });

  it("renders the VAT ID field directly before country", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await screen.findByLabelText(/vat id/i);

    const labels = Array.from(document.querySelectorAll("label")).map((label) =>
      label.textContent?.replace(/\*/g, "").trim()
    );

    expect(labels.indexOf("VAT ID")).toBe(labels.indexOf("Country") - 1);
  });

  it("keeps the edit frame visible while customer data loads", () => {
    vi.mocked(customersApi.getCustomer).mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof customersApi.getCustomer>>>(
          () => {}
        )
    );

    renderWithRouter();

    expect(
      screen.getByRole("heading", { name: /edit customer/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading customer form" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Loading\.\.\.$/i)).not.toBeInTheDocument();
  });

  it("does not expose relationship fields on the customer master-data form", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await screen.findByLabelText(/customer name/i);

    const masterDataForm = screen.getByRole("form", {
      name: /customer master data/i,
    });
    expect(
      within(masterDataForm).queryByLabelText(/email/i)
    ).not.toBeInTheDocument();
    expect(
      within(masterDataForm).queryByLabelText(/phone/i)
    ).not.toBeInTheDocument();
    expect(
      within(masterDataForm).queryByLabelText(/notes/i)
    ).not.toBeInTheDocument();
  });

  it("adds a separate establishment relationship when update permission is present", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(
      customersApi.createCustomerEstablishmentRelationship
    ).mockResolvedValue({
      id: "relationship-456",
      customer_id: mockCustomer.id,
      establishment_id: "establishment-456",
      establishment: {
        id: "establishment-456",
        name: "Hamburg Establishment",
      },
      contact: {
        name: "Ada Lovelace",
        email: "ada@secpal.dev",
        phone: null,
      },
      notes: "Hamburg relationship",
      created_at: "2026-07-16T00:00:00Z",
      updated_at: "2026-07-16T00:00:00Z",
    });

    renderWithRouter();

    const addButton = await screen.findByRole("button", {
      name: /add relationship/i,
    });
    expect(customersApi.listCustomerEstablishmentOptions).toHaveBeenCalledWith(
      mockCustomer.legal_entity_id
    );
    await user.click(
      screen.getByRole("combobox", { name: /new establishment/i })
    );
    await user.click(
      await screen.findByRole("option", { name: "Hamburg Establishment" })
    );
    await user.type(
      screen.getByLabelText(/relationship contact name/i),
      "Ada Lovelace"
    );
    await user.type(
      screen.getByLabelText(/relationship email/i),
      "ada@secpal.dev"
    );
    await user.type(
      screen.getByLabelText(/relationship notes/i),
      "Hamburg relationship"
    );
    await user.click(addButton);

    await waitFor(() => {
      expect(
        customersApi.createCustomerEstablishmentRelationship
      ).toHaveBeenCalledWith(mockCustomer.id, {
        establishment_id: "establishment-456",
        contact: {
          name: "Ada Lovelace",
          email: "ada@secpal.dev",
        },
        notes: "Hamburg relationship",
      });
    });
    expect(
      await screen.findByText("Hamburg Establishment")
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/customer name/i)).toHaveValue(
      "Existing Customer"
    );
  });

  it("does not offer relationship creation without update permission", async () => {
    mockUseUserCapabilities.mockReturnValue({
      actions: {
        customers: { create: false, update: false, delete: false },
      },
    });
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await screen.findByLabelText(/customer name/i);
    expect(
      screen.queryByRole("button", { name: /add relationship/i })
    ).not.toBeInTheDocument();
    expect(
      customersApi.listCustomerEstablishmentOptions
    ).not.toHaveBeenCalled();
  });

  it("updates customer with modified data", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockResolvedValue({
      ...mockCustomer,
      name: "Updated Customer",
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue(
        "Existing Customer"
      );
    });

    // Modify name
    const nameInput = screen.getByLabelText(/customer name/i);
    fireEvent.change(nameInput, {
      target: { value: "Updated Customer" },
    });

    // Submit
    await user.click(screen.getByRole("button", { name: /save|update/i }));

    await waitFor(() => {
      expect(customersApi.updateCustomer).toHaveBeenCalledWith(
        "customer-123",
        expect.objectContaining({
          name: "Updated Customer",
        })
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith("/customers/customer-123");
  });

  it("trims the customer VAT ID before updating", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockResolvedValue({
      ...mockCustomer,
      vat_id: "DE987654321",
    });

    renderWithRouter();

    const vatIdInput = await screen.findByLabelText(/vat id/i);
    await user.clear(vatIdInput);
    await user.type(vatIdInput, " DE987654321 ");
    await user.click(screen.getByRole("button", { name: /save|update/i }));

    await waitFor(() => {
      expect(customersApi.updateCustomer).toHaveBeenCalledWith(
        "customer-123",
        expect.objectContaining({ vat_id: "DE987654321" })
      );
    });
  });

  it("maps a whitespace-only customer VAT ID to null", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockResolvedValue({
      ...mockCustomer,
      vat_id: null,
    });

    renderWithRouter();

    const vatIdInput = await screen.findByLabelText(/vat id/i);
    await user.clear(vatIdInput);
    await user.type(vatIdInput, "   ");
    await user.click(screen.getByRole("button", { name: /save|update/i }));

    await waitFor(() => {
      expect(customersApi.updateCustomer).toHaveBeenCalledWith(
        "customer-123",
        expect.objectContaining({ vat_id: null })
      );
    });
  });

  it("updates billing address", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/street/i)).toHaveValue("Old Street 10");
    });

    // Modify street
    const streetInput = screen.getByLabelText(/street/i);
    fireEvent.change(streetInput, {
      target: { value: "New Street 20" },
    });

    await user.click(screen.getByRole("button", { name: /save|update/i }));

    await waitFor(() => {
      expect(customersApi.updateCustomer).toHaveBeenCalledWith(
        "customer-123",
        expect.objectContaining({
          billing_address: expect.objectContaining({
            street: "New Street 20",
          }),
        })
      );
    });
  });

  it("displays error message on load failure", async () => {
    vi.mocked(customersApi.getCustomer).mockRejectedValue(
      new Error("Customer not found")
    );

    renderWithRouter();

    const loadError = await screen.findByText(/customer not found/i);
    expect(loadError).toBeInTheDocument();
    expect(loadError.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
  });

  it("keeps load and submit errors on canonical theme tokens", async () => {
    vi.mocked(customersApi.getCustomer).mockRejectedValueOnce(
      new Error("Customer not found")
    );

    renderWithRouter();

    const loadError = await screen.findByText(/customer not found/i);
    expect(loadError.closest('[data-slot="alert"]')).toHaveClass(
      "text-foreground"
    );

    vi.clearAllMocks();
  });

  it("displays error message on update failure", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockRejectedValue(
      new Error("Update failed")
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue(
        "Existing Customer"
      );
    });

    await user.click(screen.getByRole("button", { name: /save|update/i }));

    await waitFor(() => {
      expect(screen.getByText(/update failed/i)).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("navigates back on cancel", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue(
        "Existing Customer"
      );
    });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/customers/customer-123");
  });

  it("disables submit button while saving", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue(
        "Existing Customer"
      );
    });

    const submitButton = screen.getByRole("button", { name: /save|update/i });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  it("ignores a late-resolving fetch for the previous customer after navigating between /customers/:id/edit routes", async () => {
    const customerA = {
      ...mockCustomer,
      id: "customer-A",
      name: "Customer A",
      customer_number: "CUST-A",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
    };
    const customerB = {
      ...mockCustomer,
      id: "customer-B",
      name: "Customer B",
      customer_number: "CUST-B",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
    };

    let resolveCustomerA:
      | ((
          customer: Awaited<ReturnType<typeof customersApi.getCustomer>>
        ) => void)
      | undefined;
    vi.mocked(customersApi.getCustomer).mockImplementation(async (id) => {
      if (id === "customer-A") {
        return new Promise((resolve) => {
          resolveCustomerA = resolve;
        });
      }
      return customerB;
    });

    window.history.pushState({}, "", "/customers/customer-A/edit");
    renderWithRouter();

    // Navigate to B while A is still in flight. B resolves immediately.
    await act(async () => {
      window.history.pushState({}, "", "/customers/customer-B/edit");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue("Customer B");
    });

    // Late A resolution must NOT refill the form with Customer A's data.
    await act(async () => {
      resolveCustomerA?.(customerA);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText(/customer name/i)).toHaveValue("Customer B");
    expect(screen.queryByDisplayValue("Customer A")).not.toBeInTheDocument();
  });

  it("clears the previous customer's form when navigating between /customers/:id/edit routes", async () => {
    const customerA = {
      ...mockCustomer,
      id: "customer-A",
      name: "Customer A",
      customer_number: "CUST-A",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
    };
    const customerB = {
      ...mockCustomer,
      id: "customer-B",
      name: "Customer B",
      customer_number: "CUST-B",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
    };

    let resolveCustomerB:
      | ((
          customer: Awaited<ReturnType<typeof customersApi.getCustomer>>
        ) => void)
      | undefined;
    vi.mocked(customersApi.getCustomer).mockImplementation(async (id) => {
      if (id === "customer-A") {
        return customerA;
      }
      return new Promise((resolve) => {
        resolveCustomerB = resolve;
      });
    });

    window.history.pushState({}, "", "/customers/customer-A/edit");
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue("Customer A");
    });

    // Param-only navigation: same route pattern, different `:id`. React
    // Router keeps the same `CustomerEdit` instance and only updates the
    // params, so the load effect re-runs but the stored `customer` /
    // `formData` would otherwise still belong to Customer A.
    await act(async () => {
      window.history.pushState({}, "", "/customers/customer-B/edit");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: /loading customer form/i })
      ).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue("Customer A")).not.toBeInTheDocument();

    await act(async () => {
      resolveCustomerB?.(customerB);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue("Customer B");
    });
  });

  it("does not carry a reassignment selection to a customer reached by param-only navigation", async () => {
    const user = userEvent.setup();
    const reassignmentLegalEntity = {
      id: "550e8400-e29b-41d4-a716-446655440099",
      name: "SecPal Operations GmbH",
    };
    const customerA = {
      ...mockCustomer,
      id: "customer-A",
      name: "Customer A",
    };
    const customerB = {
      ...mockCustomer,
      id: "customer-B",
      name: "Customer B",
    };
    vi.mocked(
      customerLegalEntitiesApi.listCustomerLegalEntities
    ).mockResolvedValue([
      {
        id: mockCustomer.legal_entity_id,
        name: "SecPal GmbH",
      },
      reassignmentLegalEntity,
    ]);
    vi.mocked(customersApi.getCustomer).mockImplementation(async (id) =>
      id === "customer-A" ? customerA : customerB
    );
    vi.mocked(customersApi.updateCustomer).mockResolvedValue(customerB);

    window.history.pushState({}, "", "/customers/customer-A/edit");
    renderWithRouter();

    const legalEntitySelect = await screen.findByRole("combobox", {
      name: /reassign legal entity/i,
    });
    await user.click(legalEntitySelect);
    await user.click(
      await screen.findByRole("option", {
        name: reassignmentLegalEntity.name,
      })
    );

    await act(async () => {
      window.history.pushState({}, "", "/customers/customer-B/edit");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    await screen.findByDisplayValue("Customer B");
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(customersApi.updateCustomer).toHaveBeenCalledWith(
        "customer-B",
        expect.not.objectContaining({
          legal_entity_id: reassignmentLegalEntity.id,
        })
      );
    });
  });

  it("toggles is_active checkbox", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/active/i)).toBeChecked();
    });

    // Toggle off
    await user.click(screen.getByLabelText(/active/i));

    await user.click(screen.getByRole("button", { name: /save|update/i }));

    await waitFor(() => {
      expect(customersApi.updateCustomer).toHaveBeenCalledWith(
        "customer-123",
        expect.objectContaining({
          is_active: false,
        })
      );
    });
  });
});
