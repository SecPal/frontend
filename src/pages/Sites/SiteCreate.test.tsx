// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import SiteCreate from "./SiteCreate";
import * as customersApi from "../../services/customersApi";
import * as legalEntityApi from "../../services/customerLegalEntitiesApi";
import * as domainApi from "../../services/customerDomainApi";

vi.mock("../../services/customersApi");
vi.mock("../../services/customerLegalEntitiesApi");
vi.mock("../../services/customerDomainApi");

const SLOW_TEST_TIMEOUT = 20000;

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithRouter(initialRoute = "/sites/new") {
  window.history.pushState({}, "", initialRoute);
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <Routes>
          <Route path="/sites/new" element={<SiteCreate />} />
          <Route
            path="/sites/new/customer/:customerId"
            element={<SiteCreate />}
          />
        </Routes>
      </I18nProvider>
    </BrowserRouter>
  );
}

async function selectRadixOption(label: RegExp, optionName: RegExp) {
  const user = userEvent.setup();
  const trigger = screen.getByRole("combobox", { name: label });
  await waitFor(() => expect(trigger).not.toBeDisabled());
  await user.click(trigger);
  await user.click(await screen.findByRole("option", { name: optionName }));
}

async function selectSiteAssignment() {
  await waitFor(() =>
    expect(domainApi.listEstablishmentLookups).toHaveBeenCalledWith(
      "legal-entity-1"
    )
  );
  await selectRadixOption(/establishment/i, /IT Department/i);
  await selectRadixOption(/customer/i, /Customer One/i);
}

describe("SiteCreate", () => {
  const mockCustomers = [
    {
      id: "customer-1",
      name: "Customer One",
      is_legal_entity: false,
      is_establishment: false,
      customer_number: "C001",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
      billing_address: {
        street: "Street 1",
        city: "City 1",
        postal_code: "12345",
        country: "DE",
      },
      is_active: true,
      sites_count: 0,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "customer-2",
      name: "Customer Two",
      customer_number: "C002",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
      billing_address: {
        street: "Street 2",
        city: "City 2",
        postal_code: "67890",
        country: "DE",
      },
      is_active: true,
      sites_count: 5,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  const mockCreatedSite = {
    id: "site-new",
    site_number: "SITE-2025-001",
    name: "new site",
    type: "permanent" as const,
    customer_id: "customer-1",
    legal_entity_id: "legal-entity-1",
    establishment_id: "establishment-1",
    address: {
      street: "Test Street 1",
      city: "Test City",
      postal_code: "12345",
      country: "DE",
    },
    full_address: "Test Street 1, 12345 Test City, DE",
    is_active: true,
    is_expired: false,
    created_at: "2025-01-20T00:00:00Z",
    updated_at: "2025-01-20T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockResolvedValue([
      { id: "legal-entity-1", name: "SecPal GmbH" },
    ]);
    vi.mocked(domainApi.listEstablishmentLookups).mockResolvedValue([
      { id: "establishment-1", name: "IT Department" },
      { id: "establishment-2", name: "Security Team" },
    ]);
    vi.mocked(domainApi.listCustomerLookups).mockResolvedValue(
      mockCustomers.map(({ id, name }) => ({ id, name }))
    );
  });

  it("loads the authorized domain cascade on mount", async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(legalEntityApi.listCustomerLegalEntities).toHaveBeenCalledTimes(1);
      expect(domainApi.listEstablishmentLookups).toHaveBeenCalledWith(
        "legal-entity-1"
      );
    });
  });

  it("displays form fields", async () => {
    renderWithRouter();

    expect(
      await screen.findByRole(
        "combobox",
        { name: /customer/i },
        { timeout: SLOW_TEST_TIMEOUT }
      )
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/site name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/legal entity/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/establishment/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/street/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
  });

  it("keeps optional contact labels on canonical muted tokens", async () => {
    renderWithRouter();

    await screen.findByLabelText(/customer/i);

    const optionalLabel = screen.getByText(/\(optional\)/i);
    expect(optionalLabel).toHaveClass("text-muted-foreground");
  });

  it("keeps the route customer pending until its establishment is selected", async () => {
    renderWithRouter("/sites/new/customer/customer-1");

    await waitFor(() =>
      expect(domainApi.listEstablishmentLookups).toHaveBeenCalledWith(
        "legal-entity-1"
      )
    );
    expect(screen.getByRole("combobox", { name: /customer/i })).toBeDisabled();
  });

  it("keeps the create error alert on canonical theme tokens", async () => {
    vi.mocked(customersApi.createSite).mockRejectedValue(
      new Error("Create failed")
    );

    renderWithRouter();

    await screen.findByLabelText(/customer/i);
    await selectSiteAssignment();
    fireEvent.change(screen.getByLabelText(/site name/i), {
      target: { value: "new site" },
    });
    fireEvent.change(screen.getByLabelText(/street/i), {
      target: { value: "Test Street 1" },
    });
    fireEvent.change(screen.getByLabelText(/city/i), {
      target: { value: "Test City" },
    });
    fireEvent.change(screen.getByLabelText(/postal code/i), {
      target: { value: "12345" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create site/i }));

    const alert = await screen.findByText(/create failed/i);
    expect(alert).toHaveAttribute("data-slot", "alert-description");
    expect(alert.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
  });

  it(
    "submits form with valid data",
    async () => {
      vi.mocked(customersApi.createSite).mockResolvedValue(mockCreatedSite);

      renderWithRouter();

      await screen.findByLabelText(/customer/i);

      // Fill form
      await selectSiteAssignment();
      fireEvent.change(screen.getByLabelText(/site name/i), {
        target: { value: "new site" },
      });
      fireEvent.change(screen.getByLabelText(/street/i), {
        target: { value: "Test Street 1" },
      });
      fireEvent.change(screen.getByLabelText(/city/i), {
        target: { value: "Test City" },
      });
      fireEvent.change(screen.getByLabelText(/postal code/i), {
        target: { value: "12345" },
      });

      // Submit
      fireEvent.click(screen.getByRole("button", { name: /create site/i }));

      await waitFor(() => {
        expect(customersApi.createSite).toHaveBeenCalledWith({
          customer_id: "customer-1",
          legal_entity_id: "legal-entity-1",
          establishment_id: "establishment-1",
          name: "new site",
          type: "permanent",
          address: {
            street: "Test Street 1",
            city: "Test City",
            postal_code: "12345",
            country: "DE",
          },
        });
        expect(mockNavigate).toHaveBeenCalledWith("/sites/site-new");
      });
    },
    SLOW_TEST_TIMEOUT
  );

  it(
    "displays validation errors from API",
    async () => {
      const validationError = new Error("Validation failed") as Error & {
        errors?: Record<string, string[]>;
      };
      validationError.errors = {
        customer_id: ["The customer field is required."],
        name: ["The name must not exceed 255 characters."],
        "address.street": ["The street field must be a valid address."],
        "address.postal_code": ["The postal code field is required."],
        "contact.email": ["The contact email field must be a valid email."],
      };
      vi.mocked(customersApi.createSite).mockRejectedValue(validationError);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/customer/i)).toBeInTheDocument();
      });

      // Fill all required fields to bypass HTML5 validation
      await selectSiteAssignment();
      fireEvent.change(screen.getByLabelText(/site name/i), {
        target: { value: "Test Site" },
      });
      fireEvent.change(screen.getByLabelText(/street/i), {
        target: { value: "Invalid Street" },
      });
      fireEvent.change(screen.getByLabelText(/city/i), {
        target: { value: "Test City" },
      });
      fireEvent.change(screen.getByLabelText(/postal code/i), {
        target: { value: "12345" },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "not-an-email@secpal.dev" },
      });

      // Submit - API will reject with validation errors
      fireEvent.click(screen.getByRole("button", { name: /create site/i }));

      await waitFor(() => {
        expect(customersApi.createSite).toHaveBeenCalled();
        expect(
          screen.getByRole("combobox", { name: /customer/i })
        ).toHaveAttribute("aria-describedby", "site-customer-error");
        expect(screen.getByLabelText(/site name/i)).toHaveAttribute(
          "aria-describedby",
          "site-name-error"
        );
        expect(screen.getByLabelText(/street/i)).toHaveAttribute(
          "aria-describedby",
          "site-street-error"
        );
        expect(screen.getByLabelText(/postal code/i)).toHaveAttribute(
          "aria-describedby",
          "site-postal-code-error"
        );
        expect(screen.getByLabelText(/email/i)).toHaveAttribute(
          "aria-describedby",
          "site-contact-email-error"
        );
        expect(
          screen.getByText(/the customer field is required/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/the name must not exceed 255 characters/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/the street field must be a valid address/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/the postal code field is required/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/the contact email field must be a valid email/i)
        ).toBeInTheDocument();
      });
    },
    SLOW_TEST_TIMEOUT
  );

  it(
    "clears field errors when resubmitting",
    async () => {
      const validationError = new Error("Validation failed") as Error & {
        errors?: Record<string, string[]>;
      };
      validationError.errors = {
        name: ["The name must be at least 3 characters."],
      };
      vi.mocked(customersApi.createSite)
        .mockRejectedValueOnce(validationError)
        .mockResolvedValueOnce(mockCreatedSite);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/customer/i)).toBeInTheDocument();
      });

      await selectSiteAssignment();

      // Fill fields with data that will trigger validation error
      fireEvent.change(screen.getByLabelText(/site name/i), {
        target: { value: "AB" },
      });
      fireEvent.change(screen.getByLabelText(/street/i), {
        target: { value: "Test Street" },
      });
      fireEvent.change(screen.getByLabelText(/city/i), {
        target: { value: "Test City" },
      });
      fireEvent.change(screen.getByLabelText(/postal code/i), {
        target: { value: "12345" },
      });

      // Submit - API will reject
      fireEvent.click(screen.getByRole("button", { name: /create site/i }));

      await waitFor(() => {
        expect(customersApi.createSite).toHaveBeenCalledTimes(1);
        expect(
          screen.getByText(/the name must be at least 3 characters/i)
        ).toBeInTheDocument();
      });

      // Fix the validation error
      const nameInput = screen.getByLabelText(/site name/i);
      fireEvent.change(nameInput, {
        target: { value: "Valid site name" },
      });
      fireEvent.click(screen.getByRole("button", { name: /create site/i }));

      // Error should be cleared and navigate should be called
      await waitFor(() => {
        expect(customersApi.createSite).toHaveBeenCalledTimes(2);
        expect(
          screen.queryByText(/the name must be at least 3 characters/i)
        ).not.toBeInTheDocument();
        expect(mockNavigate).toHaveBeenCalledWith("/sites/site-new");
      });
    },
    SLOW_TEST_TIMEOUT
  );

  it("disables the cascade while legal entities load", () => {
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockImplementation(
      () => new Promise(() => {})
    );

    renderWithRouter();

    expect(
      screen.getByRole("heading", { name: /new site/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/legal entity/i)).toBeDisabled();
    expect(screen.getByLabelText(/site name/i)).toBeInTheDocument();
  });

  it("displays error when data loading fails", async () => {
    vi.mocked(legalEntityApi.listCustomerLegalEntities).mockRejectedValue(
      new Error("Failed to load legal entities")
    );

    renderWithRouter();

    await waitFor(() => {
      expect(
        screen.getByText(/failed to load legal entities/i)
      ).toBeInTheDocument();
    });
  });

  it(
    "includes optional contact information when provided",
    async () => {
      vi.mocked(customersApi.createSite).mockResolvedValue(mockCreatedSite);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/customer/i)).toBeInTheDocument();
      });

      await selectSiteAssignment();
      fireEvent.change(screen.getByLabelText(/site name/i), {
        target: { value: "new site" },
      });
      fireEvent.change(screen.getByLabelText(/street/i), {
        target: { value: "Test Street" },
      });
      fireEvent.change(screen.getByLabelText(/city/i), {
        target: { value: "Test City" },
      });
      fireEvent.change(screen.getByLabelText(/postal code/i), {
        target: { value: "12345" },
      });

      // Fill contact info
      fireEvent.change(screen.getByLabelText(/^name$/i), {
        target: { value: "John Doe" },
      });
      fireEvent.change(screen.getByLabelText(/email/i), {
        target: { value: "john@secpal.dev" },
      });
      fireEvent.change(screen.getByLabelText(/phone/i), {
        target: { value: "+49 123 456789" },
      });

      fireEvent.click(screen.getByRole("button", { name: /create site/i }));

      await waitFor(() => {
        expect(customersApi.createSite).toHaveBeenCalledWith(
          expect.objectContaining({
            contact: {
              name: "John Doe",
              email: "john@secpal.dev",
              phone: "+49 123 456789",
            },
          })
        );
      });
    },
    SLOW_TEST_TIMEOUT
  );

  it(
    "preserves batched field updates in the submitted payload",
    async () => {
      vi.mocked(customersApi.createSite).mockResolvedValue(mockCreatedSite);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/customer/i)).toBeInTheDocument();
      });

      await selectSiteAssignment();
      fireEvent.change(screen.getByLabelText(/site name/i), {
        target: { value: "Race Safe Site" },
      });
      fireEvent.change(screen.getByLabelText(/postal code/i), {
        target: { value: "54321" },
      });

      act(() => {
        fireEvent.change(screen.getByLabelText(/street/i), {
          target: { value: "Concurrent Street 1" },
        });
        fireEvent.change(screen.getByLabelText(/city/i), {
          target: { value: "Concurrent City" },
        });
      });

      fireEvent.click(screen.getByRole("button", { name: /create site/i }));

      await waitFor(() => {
        expect(customersApi.createSite).toHaveBeenCalledWith(
          expect.objectContaining({
            address: expect.objectContaining({
              street: "Concurrent Street 1",
              city: "Concurrent City",
              postal_code: "54321",
            }),
          })
        );
      });
    },
    SLOW_TEST_TIMEOUT
  );
});
