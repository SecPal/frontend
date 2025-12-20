// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Tests for SiteCreate component
 * Epic #210 - Customer & Site Management
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import SiteCreate from "./SiteCreate";
import * as customersApi from "../../services/customersApi";
import * as organizationalUnitStore from "../../lib/organizationalUnitStore";

// Mock the API modules
vi.mock("../../services/customersApi");
vi.mock("../../lib/organizationalUnitStore");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({}),
  };
});

describe("SiteCreate", () => {
  const mockCustomers = [
    {
      id: "customer-1",
      customer_number: "KD-2025-0001",
      name: "Test Customer",
      billing_address: {
        street: "Test Street",
        city: "Test City",
        postal_code: "12345",
        country: "DE",
      },
      tenant_id: "tenant-1",
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  const mockOrgUnits = [
    {
      id: "org-unit-1",
      name: "Test Org Unit",
      type: "branch" as const,
      parent_id: null,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
      cachedAt: new Date(),
      lastSynced: new Date(),
    },
  ];

  const mockCreatedSite = {
    id: "site-1",
    site_number: "ST-2025-0001",
    name: "Test Site",
    customer_id: "customer-1",
    organizational_unit_id: "org-unit-1",
    type: "permanent" as const,
    address: {
      street: "Test Street 123",
      city: "Test City",
      postal_code: "12345",
      country: "DE",
    },
    is_active: true,
    is_expired: false,
    full_address: "Test Street 123, 12345 Test City, DE",
    tenant_id: "tenant-1",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock successful API responses
    vi.mocked(customersApi.listCustomers).mockResolvedValue({
      data: mockCustomers,
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: 1,
      },
    });

    vi.mocked(
      organizationalUnitStore.listOrganizationalUnits
    ).mockResolvedValue(mockOrgUnits);

    vi.mocked(customersApi.createSite).mockResolvedValue(mockCreatedSite);

    // Initialize i18n
    i18n.loadAndActivate({ locale: "en", messages: {} });
  });

  function renderComponent() {
    return render(
      <BrowserRouter>
        <I18nProvider i18n={i18n}>
          <SiteCreate />
        </I18nProvider>
      </BrowserRouter>
    );
  }

  it("loads customers and organizational units on mount", async () => {
    renderComponent();

    await waitFor(() => {
      expect(customersApi.listCustomers).toHaveBeenCalledWith({
        per_page: 100,
      });
      expect(
        organizationalUnitStore.listOrganizationalUnits
      ).toHaveBeenCalled();
    });
  });

  it("submits form with correct data including Content-Type header", async () => {
    renderComponent();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    // Fill out the form
    const customerSelect = screen.getByLabelText(/customer/i);
    const orgUnitSelect = screen.getByLabelText(/organizational unit/i);
    const nameInput = screen.getByLabelText(/site name/i);
    const streetInput = screen.getByLabelText(/street/i);
    const cityInput = screen.getByLabelText(/city/i);
    const postalCodeInput = screen.getByLabelText(/postal code/i);

    fireEvent.change(customerSelect, { target: { value: "customer-1" } });
    fireEvent.change(orgUnitSelect, { target: { value: "org-unit-1" } });
    fireEvent.change(nameInput, { target: { value: "Test Site" } });
    fireEvent.change(streetInput, { target: { value: "Test Street 123" } });
    fireEvent.change(cityInput, { target: { value: "Test City" } });
    fireEvent.change(postalCodeInput, { target: { value: "12345" } });

    // Submit form
    const submitButton = screen.getByRole("button", { name: /anlegen/i });
    fireEvent.click(submitButton);

    // Verify createSite was called with correct data
    await waitFor(() => {
      expect(customersApi.createSite).toHaveBeenCalledWith({
        customer_id: "customer-1",
        organizational_unit_id: "org-unit-1",
        name: "Test Site",
        type: "permanent",
        address: {
          street: "Test Street 123",
          city: "Test City",
          postal_code: "12345",
          country: "DE",
        },
        is_active: true,
      });
    });

    // Verify navigation to detail page
    expect(mockNavigate).toHaveBeenCalledWith("/sites/site-1");
  });

  it("displays validation errors from backend", async () => {
    const mockErrors = {
      name: ["The name field is required."],
      "address.street": ["The street field is required."],
    };

    vi.mocked(customersApi.createSite).mockRejectedValue({
      message: "Validation failed",
      errors: mockErrors,
    });

    renderComponent();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
    });

    // Submit empty form
    const submitButton = screen.getByRole("button", { name: /anlegen/i });
    fireEvent.click(submitButton);

    // Verify error messages are displayed
    await waitFor(() => {
      expect(
        screen.getByText("Please correct the errors below.")
      ).toBeInTheDocument();
      expect(
        screen.getByText("The name field is required.")
      ).toBeInTheDocument();
      expect(
        screen.getByText("The street field is required.")
      ).toBeInTheDocument();
    });
  });

  it("pre-selects customer from URL parameter", async () => {
    vi.mock("react-router-dom", async () => {
      const actual = await vi.importActual("react-router-dom");
      return {
        ...actual,
        useNavigate: () => mockNavigate,
        useParams: () => ({ customerId: "customer-1" }),
      };
    });

    renderComponent();

    await waitFor(() => {
      const customerSelect = screen.getByLabelText(
        /customer/i
      ) as HTMLSelectElement;
      expect(customerSelect.value).toBe("customer-1");
    });
  });
});
