// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import SiteCreate from "./SiteCreate";
import * as customersApi from "../../services/customersApi";
import * as organizationalUnitApi from "../../services/organizationalUnitApi";

vi.mock("../../services/customersApi");
vi.mock("../../services/organizationalUnitApi");

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

describe("SiteCreate", () => {
  const mockCustomers = [
    {
      id: "customer-1",
      name: "Customer One",
      customer_number: "C001",
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

  const mockOrgUnits = [
    {
      id: "org-1",
      type: "department" as const,
      name: "IT Department",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "org-2",
      type: "division" as const,
      name: "Security Team",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  const mockCreatedSite = {
    id: "site-new",
    site_number: "SITE-2025-001",
    name: "New Site",
    type: "permanent" as const,
    customer_id: "customer-1",
    organizational_unit_id: "org-1",
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
    vi.mocked(customersApi.listCustomers).mockResolvedValue({
      data: mockCustomers,
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: 2,
      },
    });
    vi.mocked(organizationalUnitApi.listOrganizationalUnits).mockResolvedValue({
      data: mockOrgUnits,
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: 2,
        root_unit_ids: [],
      },
    });
  });

  it("loads customers and organizational units on mount", async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(customersApi.listCustomers).toHaveBeenCalledWith({
        per_page: 100,
      });
      expect(
        organizationalUnitApi.listOrganizationalUnits
      ).toHaveBeenCalledWith({
        per_page: 100,
      });
    });
  });

  it("displays form fields", async () => {
    renderWithRouter();

    expect(
      await screen.findByLabelText(/customer/i, undefined, {
        timeout: SLOW_TEST_TIMEOUT,
      })
    ).toBeInTheDocument();

    expect(screen.getByLabelText(/organizational unit/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/site name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/street/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
  });

  it("pre-selects customer when customerId is in URL", async () => {
    renderWithRouter("/sites/new/customer/customer-1");

    await waitFor(() => {
      const customerSelect = screen.getByLabelText(
        /customer/i
      ) as HTMLSelectElement;
      expect(customerSelect.value).toBe("customer-1");
    });
  });

  it(
    "submits form with valid data",
    async () => {
      vi.mocked(customersApi.createSite).mockResolvedValue(mockCreatedSite);

      renderWithRouter();

      await screen.findByLabelText(/customer/i);

      // Fill form
      fireEvent.change(screen.getByLabelText(/customer/i), {
        target: { value: "customer-1" },
      });
      fireEvent.change(screen.getByLabelText(/organizational unit/i), {
        target: { value: "org-1" },
      });
      fireEvent.change(screen.getByLabelText(/site name/i), {
        target: { value: "New Site" },
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
        expect(customersApi.createSite).toHaveBeenCalledWith(
          expect.objectContaining({
            customer_id: "customer-1",
            organizational_unit_id: "org-1",
            name: "New Site",
            type: "permanent",
            address: expect.objectContaining({
              street: "Test Street 1",
              city: "Test City",
              postal_code: "12345",
              country: "DE",
            }),
          })
        );
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
        name: ["The name must not exceed 255 characters."],
        "address.street": ["The street field must be a valid address."],
      };
      vi.mocked(customersApi.createSite).mockRejectedValue(validationError);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/customer/i)).toBeInTheDocument();
      });

      // Fill all required fields to bypass HTML5 validation
      fireEvent.change(screen.getByLabelText(/customer/i), {
        target: { value: "customer-1" },
      });
      fireEvent.change(screen.getByLabelText(/organizational unit/i), {
        target: { value: "org-1" },
      });
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

      // Submit - API will reject with validation errors
      fireEvent.click(screen.getByRole("button", { name: /create site/i }));

      await waitFor(() => {
        expect(customersApi.createSite).toHaveBeenCalled();
        expect(
          screen.getByText(/the name must not exceed 255 characters/i)
        ).toBeInTheDocument();
        expect(
          screen.getByText(/the street field must be a valid address/i)
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

      fireEvent.change(screen.getByLabelText(/customer/i), {
        target: { value: "customer-1" },
      });
      fireEvent.change(screen.getByLabelText(/organizational unit/i), {
        target: { value: "org-1" },
      });

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
        target: { value: "Valid Site Name" },
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

  it("displays loading state while loading data", () => {
    vi.mocked(customersApi.listCustomers).mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof customersApi.listCustomers>>>(
          () => {}
        )
    );
    vi.mocked(organizationalUnitApi.listOrganizationalUnits).mockImplementation(
      () =>
        new Promise<
          Awaited<
            ReturnType<typeof organizationalUnitApi.listOrganizationalUnits>
          >
        >(() => {})
    );

    renderWithRouter();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("displays error when data loading fails", async () => {
    vi.mocked(customersApi.listCustomers).mockRejectedValue(
      new Error("Failed to load customers")
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/failed to load customers/i)).toBeInTheDocument();
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

      fireEvent.change(screen.getByLabelText(/customer/i), {
        target: { value: "customer-1" },
      });
      fireEvent.change(screen.getByLabelText(/organizational unit/i), {
        target: { value: "org-1" },
      });
      fireEvent.change(screen.getByLabelText(/site name/i), {
        target: { value: "New Site" },
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

      fireEvent.change(screen.getByLabelText(/customer/i), {
        target: { value: "customer-1" },
      });
      fireEvent.change(screen.getByLabelText(/organizational unit/i), {
        target: { value: "org-1" },
      });
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
