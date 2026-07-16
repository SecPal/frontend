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
import { BrowserRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import CustomerCreate from "./CustomerCreate";
import * as customerLegalEntitiesApi from "../../services/customerLegalEntitiesApi";
import * as customersApi from "../../services/customersApi";

// Mock the API
vi.mock("../../services/customerLegalEntitiesApi");
vi.mock("../../services/customersApi");

const SLOW_TEST_TIMEOUT = 20000;
const QUERY_TIMEOUT = 15000;

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithRouter(component: React.ReactElement) {
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>{component}</I18nProvider>
    </BrowserRouter>
  );
}

async function renderCustomerCreate() {
  const rendered = renderWithRouter(<CustomerCreate />);

  await waitFor(() => {
    expect(
      screen.getByRole("combobox", { name: /legal entity/i })
    ).not.toBeDisabled();
  });

  return rendered;
}

const legalEntities = [
  {
    id: "550e8400-e29b-41d4-a716-446655440001",
    name: "SecPal GmbH",
  },
  {
    id: "550e8400-e29b-41d4-a716-446655440002",
    name: "SecPal Operations GmbH",
  },
];
const firstLegalEntity = legalEntities[0]!;
const secondLegalEntity = legalEntities[1]!;

async function chooseFirstLegalEntity() {
  await chooseLegalEntity(firstLegalEntity.name);
}

async function chooseLegalEntity(name: string) {
  const user = userEvent.setup();
  const trigger = await screen.findByRole("combobox", {
    name: /legal entity/i,
  });

  await user.click(trigger);
  await user.click(await screen.findByRole("option", { name }));
}

describe("CustomerCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(
      customerLegalEntitiesApi.listCustomerLegalEntities
    ).mockResolvedValue(legalEntities);
  });

  it("renders the form with all required fields", async () => {
    await renderCustomerCreate();

    expect(screen.getByLabelText(/customer name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/vat id/i)).toBeInTheDocument();
    expect(
      screen.getByRole("combobox", { name: /legal entity/i })
    ).toHaveAttribute("data-slot", "select-trigger");
    expect(
      screen.getByRole("combobox", { name: /legal entity/i })
    ).toHaveAttribute("aria-required", "true");
    expect(screen.getByLabelText(/street/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create customer/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("renders legal entity as the first form field", async () => {
    await renderCustomerCreate();

    const legalEntityField = screen.getByRole("combobox", {
      name: /legal entity/i,
    });
    const customerNameField = screen.getByLabelText(/customer name/i);

    expect(
      legalEntityField.compareDocumentPosition(customerNameField) &
        Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("renders the VAT ID field directly before country", async () => {
    await renderCustomerCreate();

    const labels = Array.from(document.querySelectorAll("label")).map((label) =>
      label.textContent?.replace(/\*/g, "").trim()
    );

    expect(labels.indexOf("VAT ID")).toBe(labels.indexOf("Country") - 1);
  });

  it("submits the optional VAT ID when provided", async () => {
    vi.mocked(customersApi.createCustomer).mockResolvedValue({
      id: "customer-123",
      legal_entity_id: firstLegalEntity.id,
      customer_number: "KD-2026-0001",
      name: "ACME GmbH",
      vat_id: "DE123456789",
      billing_address: {
        street: "Main Street 1",
        city: "Berlin",
        postal_code: "10115",
        country: "DE",
      },
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    });

    renderWithRouter(<CustomerCreate />);

    await chooseFirstLegalEntity();
    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "ACME GmbH" },
    });
    fireEvent.change(screen.getByLabelText(/vat id/i), {
      target: { value: "DE123456789" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Main Street 1" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "10115" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "Berlin" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() => {
      expect(customersApi.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({ vat_id: "DE123456789" })
      );
    });
  });

  it("renders contact fields", async () => {
    await renderCustomerCreate();

    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument(); // Contact name
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
  });

  it("renders notes and active checkbox", async () => {
    await renderCustomerCreate();

    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/active/i)).toBeInTheDocument();
  });

  it("keeps the create error alert on canonical theme tokens", async () => {
    vi.mocked(customersApi.createCustomer).mockRejectedValue(
      new Error("Create failed")
    );

    const user = userEvent.setup();
    renderWithRouter(<CustomerCreate />);

    await chooseFirstLegalEntity();
    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "Test Customer" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Test Street 1" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "Test City" },
    });

    await user.click(screen.getByRole("button", { name: /create customer/i }));

    const alert = await screen.findByText(/create failed/i);
    expect(alert).toHaveAttribute("data-slot", "alert-description");
    expect(alert.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
  });

  it("uses in-app validation instead of browser-native email validation", async () => {
    const user = userEvent.setup();
    renderWithRouter(<CustomerCreate />);

    await chooseFirstLegalEntity();
    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "Test Customer" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Test Street 1" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "Test City" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
      target: { value: "invalid-email" },
    });

    const emailInput = screen.getByRole("textbox", { name: /email/i });
    expect(emailInput).toHaveAttribute("type", "text");
    expect(emailInput).toHaveAttribute("inputmode", "email");

    const submitButton = screen.getByRole("button", {
      name: /create customer/i,
    });
    expect(submitButton.closest("form")).toHaveAttribute("novalidate");

    await user.click(submitButton);

    expect(
      await screen.findByText(/please enter a valid email address/i)
    ).toBeInTheDocument();
    expect(customersApi.createCustomer).not.toHaveBeenCalled();
  });

  it("submits form with valid data", async () => {
    const user = userEvent.setup();
    const mockCustomer = {
      id: "customer-123",
      name: "Test Customer",
      customer_number: "CUST-2025-001",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
      billing_address: {
        street: "Test Street 1",
        city: "Test City",
        postal_code: "12345",
        country: "DE",
      },
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(customersApi.createCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter(<CustomerCreate />);

    await chooseFirstLegalEntity();

    // Fill required fields directly to keep the happy-path test fast in full-suite runs
    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "Test Customer" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Test Street 1" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "Test City" },
    });

    // Country should already be "DE" by default
    expect(screen.getByLabelText(/country/i)).toHaveValue("DE");

    // Submit form
    await user.click(screen.getByRole("button", { name: /create customer/i }));

    // Wait for API call
    await waitFor(() => {
      expect(customersApi.createCustomer).toHaveBeenCalledWith({
        name: "Test Customer",
        legal_entity_id: firstLegalEntity.id,
        billing_address: {
          street: "Test Street 1",
          city: "Test City",
          postal_code: "12345",
          country: "DE",
        },
        is_active: true,
      });
    });

    // Should navigate to detail page
    expect(mockNavigate).toHaveBeenCalledWith("/customers/customer-123");
  });

  it("submits the selected legal entity when multiple entities are available", async () => {
    const user = userEvent.setup();
    const mockCustomer = {
      id: "customer-multiple-entity",
      name: "Multi Entity Customer",
      customer_number: "CUST-2026-001",
      legal_entity_id: secondLegalEntity.id,
      billing_address: {
        street: "Street 1",
        city: "City",
        postal_code: "12345",
        country: "DE",
      },
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    vi.mocked(customersApi.createCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter(<CustomerCreate />);

    await chooseLegalEntity(secondLegalEntity.name);
    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "Multi Entity Customer" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Street 1" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "City" },
    });

    await user.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() => {
      expect(customersApi.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          legal_entity_id: secondLegalEntity.id,
        })
      );
    });
  });

  it("does not submit a stale legal entity after authorized options refresh", async () => {
    const user = userEvent.setup();
    const replacementLegalEntity = {
      id: "550e8400-e29b-41d4-a716-446655440003",
      name: "SecPal Services GmbH",
    };
    const previousLocale = i18n.locale;
    const nextLocale = previousLocale === "de" ? "en" : "de";
    let resolveRefresh: (
      entities: Awaited<
        ReturnType<typeof customerLegalEntitiesApi.listCustomerLegalEntities>
      >
    ) => void = () => {};
    const refreshPromise = new Promise<
      Awaited<
        ReturnType<typeof customerLegalEntitiesApi.listCustomerLegalEntities>
      >
    >((resolve) => {
      resolveRefresh = resolve;
    });

    vi.mocked(customerLegalEntitiesApi.listCustomerLegalEntities)
      .mockResolvedValueOnce(legalEntities)
      .mockReturnValueOnce(refreshPromise);

    const { unmount } = renderWithRouter(<CustomerCreate />);

    await chooseLegalEntity(secondLegalEntity.name);

    try {
      act(() => {
        i18n.load(nextLocale, {});
        i18n.activate(nextLocale);
      });

      await waitFor(() => {
        expect(
          customerLegalEntitiesApi.listCustomerLegalEntities
        ).toHaveBeenCalledTimes(2);
      });
      await act(async () => {
        resolveRefresh([replacementLegalEntity]);
        await refreshPromise;
      });
      await waitFor(() => {
        expect(
          screen.getByRole("combobox", { name: /legal entity/i })
        ).toHaveTextContent("Select legal entity...");
      });

      fireEvent.change(screen.getByLabelText(/customer name/i), {
        target: { value: "Refreshed Entity Customer" },
      });
      fireEvent.change(screen.getByLabelText(/street/i), {
        target: { value: "Street 1" },
      });
      fireEvent.change(screen.getByLabelText(/postal code/i), {
        target: { value: "12345" },
      });
      fireEvent.change(screen.getByLabelText(/city/i), {
        target: { value: "City" },
      });

      await user.click(
        screen.getByRole("button", { name: /create customer/i })
      );

      expect(
        await screen.findByText(/legal entity is required/i)
      ).toBeInTheDocument();
      expect(customersApi.createCustomer).not.toHaveBeenCalled();
    } finally {
      unmount();
      if (previousLocale) {
        act(() => {
          i18n.activate(previousLocale);
        });
      }
    }
  });

  it("selects, disables, and submits the only available legal entity", async () => {
    const user = userEvent.setup();
    const mockCustomer = {
      id: "customer-single-entity",
      name: "Single Entity Customer",
      customer_number: "CUST-2026-002",
      legal_entity_id: firstLegalEntity.id,
      billing_address: {
        street: "Street 1",
        city: "City",
        postal_code: "12345",
        country: "DE",
      },
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-01T00:00:00Z",
    };

    vi.mocked(
      customerLegalEntitiesApi.listCustomerLegalEntities
    ).mockResolvedValue([firstLegalEntity]);
    vi.mocked(customersApi.createCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter(<CustomerCreate />);

    const trigger = await screen.findByRole("combobox", {
      name: /legal entity/i,
    });
    await waitFor(() => {
      expect(trigger).toBeDisabled();
      expect(trigger).toHaveTextContent(firstLegalEntity.name);
    });

    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "Single Entity Customer" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Street 1" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "City" },
    });

    await user.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() => {
      expect(customersApi.createCustomer).toHaveBeenCalledWith(
        expect.objectContaining({
          legal_entity_id: firstLegalEntity.id,
        })
      );
    });
  });

  it("shows an empty state and cannot post when no legal entity is available", async () => {
    const user = userEvent.setup();
    vi.mocked(
      customerLegalEntitiesApi.listCustomerLegalEntities
    ).mockResolvedValue([]);

    renderWithRouter(<CustomerCreate />);

    expect(
      await screen.findByText(/no legal entities are available/i)
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create customer/i })
    ).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "Blocked Customer" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Street 1" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "City" },
    });

    await user.click(screen.getByRole("button", { name: /create customer/i }));

    expect(customersApi.createCustomer).not.toHaveBeenCalled();
  });

  it("retries a failed legal entity lookup", async () => {
    const user = userEvent.setup();
    vi.mocked(customerLegalEntitiesApi.listCustomerLegalEntities)
      .mockRejectedValueOnce(new Error("Lookup unavailable"))
      .mockResolvedValueOnce(legalEntities);

    renderWithRouter(<CustomerCreate />);

    expect(await screen.findByText("Lookup unavailable")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create customer/i })
    ).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /retry/i }));

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /legal entity/i })
      ).toBeEnabled();
    });
    expect(
      customerLegalEntitiesApi.listCustomerLegalEntities
    ).toHaveBeenCalledTimes(2);
  });

  it("does not render unauthorized legal entities in visible or hidden DOM", async () => {
    const unauthorizedName = "Foreign Tenant Holding GmbH";
    const { container } = renderWithRouter(<CustomerCreate />);

    const trigger = await screen.findByRole("combobox", {
      name: /legal entity/i,
    });

    expect(trigger).toHaveTextContent("Select legal entity...");
    expect(container).not.toHaveTextContent(unauthorizedName);
    expect(container.innerHTML).not.toContain(unauthorizedName);

    await userEvent.click(trigger);
    const listbox = await screen.findByRole("listbox");
    expect(
      within(listbox).getByRole("option", { name: firstLegalEntity.name })
    ).toBeInTheDocument();
    expect(screen.queryByText(unauthorizedName)).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain(unauthorizedName);
  });

  it("requires a legal entity before creating a customer", async () => {
    const user = userEvent.setup();
    renderWithRouter(<CustomerCreate />);

    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "Test Customer" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Test Street 1" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "Test City" },
    });

    await user.click(screen.getByRole("button", { name: /create customer/i }));

    expect(
      await screen.findByText(/legal entity is required/i)
    ).toBeInTheDocument();
    expect(customersApi.createCustomer).not.toHaveBeenCalled();
  });

  it(
    "submits form with contact information",
    async () => {
      const mockCustomer = {
        id: "customer-456",
        name: "Customer with Contact",
        customer_number: "CUST-2025-002",
        legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
        billing_address: {
          street: "Street 1",
          city: "City",
          postal_code: "12345",
          country: "DE",
        },
        contact: {
          name: "John Doe",
          email: "john@secpal.dev",
          phone: "+49 123 456789",
        },
        is_active: true,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      };

      vi.mocked(customersApi.createCustomer).mockResolvedValue(mockCustomer);

      renderWithRouter(<CustomerCreate />);

      await chooseFirstLegalEntity();
      // Fill fields directly to keep this integration-style happy path within
      // suite timeout
      fireEvent.change(screen.getByLabelText(/customer name/i), {
        target: { value: "Customer with Contact" },
      });
      fireEvent.change(screen.getByLabelText(/street/i), {
        target: { value: "Street 1" },
      });
      fireEvent.change(screen.getByLabelText(/postal code/i), {
        target: { value: "12345" },
      });
      fireEvent.change(screen.getByLabelText(/city/i), {
        target: { value: "City" },
      });

      // Fill contact fields using name attributes
      const contactNameInput = screen.getByRole("textbox", { name: /^name$/i });
      fireEvent.change(contactNameInput, {
        target: { value: "John Doe" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: /email/i }), {
        target: { value: "john@secpal.dev" },
      });
      fireEvent.change(screen.getByRole("textbox", { name: /phone/i }), {
        target: { value: "+49 123 456789" },
      });

      await waitFor(
        () => {
          expect(screen.getByRole("textbox", { name: /phone/i })).toHaveValue(
            "+49 123 456789"
          );
        },
        { timeout: QUERY_TIMEOUT }
      );

      // Submit
      fireEvent.click(screen.getByRole("button", { name: /create customer/i }));

      await waitFor(
        () => {
          expect(customersApi.createCustomer).toHaveBeenCalledWith({
            name: "Customer with Contact",
            legal_entity_id: firstLegalEntity.id,
            billing_address: {
              street: "Street 1",
              city: "City",
              postal_code: "12345",
              country: "DE",
            },
            contact: {
              name: "John Doe",
              email: "john@secpal.dev",
              phone: "+49 123 456789",
            },
            is_active: true,
          });
        },
        { timeout: QUERY_TIMEOUT }
      );
    },
    SLOW_TEST_TIMEOUT
  );

  it("does not include contact if all fields are empty", async () => {
    const user = userEvent.setup();
    const mockCustomer = {
      id: "customer-789",
      name: "Customer without Contact",
      customer_number: "CUST-2025-003",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
      billing_address: {
        street: "Street 1",
        city: "City",
        postal_code: "12345",
        country: "DE",
      },
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(customersApi.createCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter(<CustomerCreate />);

    await chooseFirstLegalEntity();
    // Fill only required fields, leave contact empty
    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "Customer without Contact" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Street 1" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "City" },
    });

    await user.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() => {
      const callArg = vi.mocked(customersApi.createCustomer).mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      expect(callArg?.contact).toBeUndefined();
    });
  });

  it("displays error message on API failure", async () => {
    vi.mocked(customersApi.createCustomer).mockRejectedValue(
      new Error("Server error: Failed to create customer")
    );

    renderWithRouter(<CustomerCreate />);

    await chooseFirstLegalEntity();
    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Street" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "City" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create customer/i }));

    // Should show error
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });

    // Should not navigate
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("displays validation errors", async () => {
    vi.mocked(customersApi.createCustomer).mockRejectedValue(
      new Error(
        "name: The name field is required.\nbilling_address.street: The billing street field is required."
      )
    );

    renderWithRouter(<CustomerCreate />);

    await chooseFirstLegalEntity();
    // Fill minimal required fields to bypass HTML5 validation
    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Street" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "City" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() => {
      // Error message should contain the validation errors
      expect(
        screen.getByText(/name: The name field is required/)
      ).toBeInTheDocument();
    });
  });

  it("converts country to uppercase", async () => {
    const mockCustomer = {
      id: "customer-country",
      name: "Test",
      customer_number: "CUST-001",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
      billing_address: {
        street: "Street",
        city: "City",
        postal_code: "12345",
        country: "DE",
      },
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(customersApi.createCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter(<CustomerCreate />);

    await chooseFirstLegalEntity();
    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Street" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "City" },
    });

    // Clear default and type lowercase
    const countryInput = screen.getByLabelText(/country/i);
    fireEvent.change(countryInput, { target: { value: "de" } });

    // Should be converted to uppercase
    expect(countryInput).toHaveValue("DE");
  });

  it("includes notes when provided", async () => {
    const mockCustomer = {
      id: "customer-notes",
      name: "Test",
      customer_number: "CUST-002",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
      billing_address: {
        street: "Street",
        city: "City",
        postal_code: "12345",
        country: "DE",
      },
      notes: "Important customer",
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(customersApi.createCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter(<CustomerCreate />);

    await chooseFirstLegalEntity();
    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Street" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "City" },
    });
    fireEvent.change(screen.getByLabelText(/notes/i), {
      target: { value: "Important customer" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() => {
      const callArg = vi.mocked(customersApi.createCustomer).mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      expect(callArg?.notes).toBe("Important customer");
    });
  });

  it("navigates back on cancel", async () => {
    const user = userEvent.setup();
    renderWithRouter(<CustomerCreate />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/customers");
  });

  it("disables submit button while loading", async () => {
    vi.mocked(customersApi.createCustomer).mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof customersApi.createCustomer>>>(
          () => {}
        )
    );

    renderWithRouter(<CustomerCreate />);

    await chooseFirstLegalEntity();
    fireEvent.change(screen.getByLabelText(/customer name/i), {
      target: { value: "Test" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Street" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "City" },
    });

    const submitButton = screen.getByRole("button", {
      name: /create customer/i,
    });
    fireEvent.click(submitButton);

    // Button should be disabled during submission
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/creating/i)).toBeInTheDocument();
    });
  });
});
