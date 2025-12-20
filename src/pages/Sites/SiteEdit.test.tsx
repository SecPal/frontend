// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import SiteEdit from "./SiteEdit";
import * as customersApi from "../../services/customersApi";
import * as organizationalUnitApi from "../../services/organizationalUnitApi";

vi.mock("../../services/customersApi");
vi.mock("../../services/organizationalUnitApi");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithRouter() {
  window.history.pushState({}, "", "/sites/site-123/edit");
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <Routes>
          <Route path="/sites/:id/edit" element={<SiteEdit />} />
        </Routes>
      </I18nProvider>
    </BrowserRouter>
  );
}

describe("SiteEdit", () => {
  const mockSite = {
    id: "site-123",
    site_number: "SITE-2025-001",
    name: "Test Site",
    type: "permanent" as const,
    customer_id: "customer-1",
    organizational_unit_id: "org-1",
    address: {
      street: "Old Street 1",
      city: "Old City",
      postal_code: "11111",
      country: "DE",
    },
    full_address: "Old Street 1, 11111 Old City, DE",
    contact: {
      name: "John Doe",
      email: "john@example.com",
      phone: "+49 123 456789",
    },
    is_active: true,
    is_expired: false,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-15T00:00:00Z",
  };

  const mockCustomers = [
    {
      id: "customer-1",
      name: "Customer One",
      customer_number: "C001",
      billing_address: {
        street: "Street",
        city: "City",
        postal_code: "12345",
        country: "DE",
      },
      is_active: true,
      sites_count: 1,
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
      sites_count: 0,
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
      name: "Security Division",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  const mockUpdatedSite = {
    ...mockSite,
    name: "Updated Site Name",
    updated_at: "2025-01-20T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(customersApi.getSite).mockResolvedValue(mockSite);
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

  it("loads site data, customers, and org units on mount", async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(customersApi.getSite).toHaveBeenCalledWith("site-123");
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

  it("pre-populates form with existing site data", async () => {
    renderWithRouter();

    await waitFor(() => {
      const nameInput = screen.getByLabelText(/site name/i) as HTMLInputElement;
      expect(nameInput.value).toBe("Test Site");
    });

    const streetInput = screen.getByLabelText(/street/i) as HTMLInputElement;
    expect(streetInput.value).toBe("Old Street 1");

    const cityInput = screen.getByLabelText(/city/i) as HTMLInputElement;
    expect(cityInput.value).toBe("Old City");

    const postalInput = screen.getByLabelText(
      /postal code/i
    ) as HTMLInputElement;
    expect(postalInput.value).toBe("11111");

    const contactNameInput = screen.getByLabelText(
      /^name$/i
    ) as HTMLInputElement;
    expect(contactNameInput.value).toBe("John Doe");
  });

  it("pre-selects correct customer and org unit", async () => {
    renderWithRouter();

    await waitFor(() => {
      const customerSelect = screen.getByLabelText(
        /customer/i
      ) as HTMLSelectElement;
      expect(customerSelect.value).toBe("customer-1");
    });

    const orgUnitSelect = screen.getByLabelText(
      /organizational unit/i
    ) as HTMLSelectElement;
    expect(orgUnitSelect.value).toBe("org-1");
  });

  it("updates site with modified data", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.updateSite).mockResolvedValue(mockUpdatedSite);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/site name/i)).toBeInTheDocument();
    });

    // Modify name
    const nameInput = screen.getByLabelText(/site name/i);
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Site Name");

    // Submit
    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(customersApi.updateSite).toHaveBeenCalledWith(
        "site-123",
        expect.objectContaining({
          name: "Updated Site Name",
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith("/sites/site-123");
    });
  });

  it("displays loading state while fetching data", () => {
    renderWithRouter();

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("displays error when site loading fails", async () => {
    vi.mocked(customersApi.getSite).mockRejectedValue(
      new Error("Site not found")
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/site not found/i)).toBeInTheDocument();
    });
  });

  it("shows cancel button that navigates back", async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /cancel/i })).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole("link", { name: /cancel/i });
    expect(cancelButton).toHaveAttribute("href", "/sites/site-123");
  });

  it("handles optional contact fields", async () => {
    const user = userEvent.setup();
    const siteWithoutContact = { ...mockSite, contact: undefined };
    vi.mocked(customersApi.getSite).mockResolvedValue(siteWithoutContact);
    vi.mocked(customersApi.updateSite).mockResolvedValue(mockUpdatedSite);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/site name/i)).toBeInTheDocument();
    });

    // Add contact info
    await user.type(screen.getByLabelText(/^name$/i), "Jane Doe");
    await user.type(screen.getByLabelText(/email/i), "jane@example.com");

    await user.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(customersApi.updateSite).toHaveBeenCalledWith(
        "site-123",
        expect.objectContaining({
          contact: expect.objectContaining({
            name: "Jane Doe",
            email: "jane@example.com",
          }),
        })
      );
    });
  });
});
