// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import SitesPage from "./SitesPage";
import * as customersApi from "../../services/customersApi";
import type { Site, PaginatedResponse } from "../../types/customers";

const { mockUseUserCapabilities } = vi.hoisted(() => ({
  mockUseUserCapabilities: vi.fn(),
}));

// Mock the customers API
vi.mock("../../services/customersApi");
vi.mock("../../hooks/useUserCapabilities", () => ({
  useUserCapabilities: mockUseUserCapabilities,
}));

function TestNavigationButton({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate();

  return (
    <button type="button" onClick={() => navigate(to)}>
      {label}
    </button>
  );
}

// Helper to render with providers
const renderWithProviders = (
  initialEntries = ["/sites"],
  navigationTarget?: { to: string; label: string }
) => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={initialEntries}>
        {navigationTarget ? (
          <TestNavigationButton
            to={navigationTarget.to}
            label={navigationTarget.label}
          />
        ) : null}
        <Routes>
          <Route path="/sites" element={<SitesPage />} />
          <Route path="/sites/customer/:customerId" element={<SitesPage />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
};

const mockSites: Site[] = [
  {
    id: "site-1",
    site_number: "S001",
    name: "Main Office",
    type: "permanent",
    address: {
      street: "Main St",
      postal_code: "12345",
      city: "Berlin",
      country: "Germany",
    },
    is_active: true,
    customer_id: "cust-1",
    customer: {
      id: "cust-1",
      customer_number: "CUST-001",
      name: "Acme GmbH",
      billing_address: {
        street: "Billing St",
        postal_code: "10115",
        city: "Berlin",
        country: "DE",
      },
      is_active: true,
    },
    organizational_unit_id: "unit-1",
    contact: {
      name: "Erika Muster",
      email: "erika@example.test",
      phone: "+49 30 123456",
    },
    is_expired: false,
    full_address: "Main St, 12345 Berlin, Germany",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "site-2",
    site_number: "S002",
    name: "Project Site Alpha",
    type: "temporary",
    address: {
      street: "Project Rd",
      postal_code: "54321",
      city: "Munich",
      country: "Germany",
    },
    is_active: true,
    customer_id: "cust-2",
    customer: {
      id: "cust-2",
      customer_number: "CUST-002",
      name: "Beta AG",
      billing_address: {
        street: "Invoice Rd",
        postal_code: "80331",
        city: "Munich",
        country: "DE",
      },
      is_active: true,
    },
    organizational_unit_id: "unit-2",
    contact: null,
    valid_from: "2025-01-01",
    valid_until: "2025-12-31",
    is_expired: false,
    full_address: "Project Rd, 54321 Munich, Germany",
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
];

const mockResponse: PaginatedResponse<Site> = {
  data: mockSites,
  meta: {
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 2,
  },
};

async function selectRadixOption(label: RegExp, optionName: RegExp) {
  const user = userEvent.setup();
  await user.click(screen.getByRole("combobox", { name: label }));
  await user.click(await screen.findByRole("option", { name: optionName }));
}

describe("SitesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(customersApi.listSites).mockResolvedValue(mockResponse);
    mockUseUserCapabilities.mockReturnValue({
      actions: {
        sites: { create: true, update: true, delete: true },
      },
    });
  });

  it("should render sites list with table", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    expect(screen.getByText("Main Office")).toBeInTheDocument();
    expect(screen.getByText("S001")).toBeInTheDocument();
  });

  it("renders page chrome and table skeleton rows while initially loading", () => {
    vi.mocked(customersApi.listSites).mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof customersApi.listSites>>>(
          () => {}
        )
    );

    const { container } = renderWithProviders();

    expect(screen.getByRole("heading", { name: /sites/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /site number/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /customer/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /contact person/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading sites table/i })
    ).toBeInTheDocument();
    expect(container.querySelectorAll("tbody tr td")).toHaveLength(40);
    expect(
      container.querySelectorAll('[data-slot="ui-skeleton"]').length
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/^Loading\.\.\.$/i)).not.toBeInTheDocument();
  });

  it("should display empty state inside the table", async () => {
    vi.mocked(customersApi.listSites).mockResolvedValue({
      data: [],
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 15,
        total: 0,
      },
    });

    renderWithProviders();

    expect(await screen.findByText(/no sites found/i)).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /site number/i })
    ).toBeInTheDocument();
  });

  it("should handle API errors gracefully", async () => {
    vi.mocked(customersApi.listSites).mockRejectedValue(new Error("API Error"));

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/API Error/i)).toBeInTheDocument();
    });
    expect(
      screen.getByRole("columnheader", { name: /site number/i })
    ).toBeInTheDocument();
  });

  it("should filter sites by search term", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search sites/i);
    fireEvent.change(searchInput, { target: { value: "Main" } });

    await waitFor(() => {
      expect(customersApi.listSites).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Main" })
      );
    });
  });

  it("keeps the existing table visible while refiltering", async () => {
    vi.mocked(customersApi.listSites)
      .mockResolvedValueOnce(mockResponse)
      .mockImplementationOnce(
        () =>
          new Promise<Awaited<ReturnType<typeof customersApi.listSites>>>(
            () => {}
          )
      );

    renderWithProviders();

    expect(await screen.findByText("Main Office")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/search sites/i);
    fireEvent.change(searchInput, { target: { value: "Project" } });

    expect(screen.getByText("Main Office")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading sites table/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /site number/i })
    ).toBeInTheDocument();
  });

  it("should filter sites by type", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Clear call history to isolate this test's API calls
    vi.mocked(customersApi.listSites).mockClear();

    await selectRadixOption(/type/i, /permanent/i);

    await waitFor(() => {
      expect(customersApi.listSites).toHaveBeenCalledWith(
        expect.objectContaining({ type: "permanent" })
      );
    });
  });

  it("should filter sites by status", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    await selectRadixOption(/status/i, /inactive/i);

    await waitFor(() => {
      expect(customersApi.listSites).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false })
      );
    });
  });

  it("should display site details correctly", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Check all site fields are displayed
    expect(screen.getByText("S001")).toBeInTheDocument();
    expect(
      screen.getByText("Main St, 12345 Berlin, Germany")
    ).toBeInTheDocument();
    expect(
      screen.getByText("Project Rd, 54321 Munich, Germany")
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Acme GmbH" })).toHaveAttribute(
      "href",
      "/customers/cust-1"
    );
    expect(screen.getByText("Beta AG")).toBeInTheDocument();
    expect(screen.getByText("Erika Muster")).toBeInTheDocument();
    expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
  });

  it("should display badge for site type", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    const permanentBadges = screen.getAllByText(/permanent/i);
    const temporaryBadges = screen.getAllByText(/temporary/i);
    expect(permanentBadges.length).toBeGreaterThan(0);
    expect(temporaryBadges.length).toBeGreaterThan(0);
  });

  it("should display badge for active status", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    const activeBadges = screen.getAllByText(/active/i);
    expect(activeBadges.length).toBeGreaterThan(0);
  });

  it("should have link to new site page", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/new site/i)).toBeInTheDocument();
    });

    const newButton = screen.getByText(/new site/i);
    expect(newButton.closest("a")).toHaveAttribute("href", "/sites/new");
  });

  it("uses the customer route parameter to filter sites and prefill the create CTA", async () => {
    renderWithProviders(["/sites/customer/cust-1"]);

    await waitFor(() => {
      expect(customersApi.listSites).toHaveBeenCalledWith(
        expect.objectContaining({ customer_id: "cust-1" })
      );
    });

    expect(screen.getByRole("link", { name: /new site/i })).toHaveAttribute(
      "href",
      "/sites/new/customer/cust-1"
    );
  });

  it("hides stale customer rows while a new customer-scoped request is loading", async () => {
    vi.mocked(customersApi.listSites)
      .mockResolvedValueOnce({
        data: [mockSites[0]],
        meta: {
          current_page: 1,
          last_page: 2,
          per_page: 15,
          total: 16,
        },
      })
      .mockImplementationOnce(
        () =>
          new Promise<Awaited<ReturnType<typeof customersApi.listSites>>>(
            () => {}
          )
      );

    const user = userEvent.setup();
    renderWithProviders(["/sites/customer/cust-1"], {
      to: "/sites/customer/cust-2",
      label: "Switch customer",
    });

    expect(await screen.findByText("Main Office")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Switch customer" }));

    expect(screen.queryByText("Main Office")).not.toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading sites table/i })
    ).toBeInTheDocument();
    expect(screen.queryByText(/showing/i)).not.toBeInTheDocument();

    await waitFor(() => {
      expect(customersApi.listSites).toHaveBeenLastCalledWith(
        expect.objectContaining({ customer_id: "cust-2" })
      );
    });
  });

  it("hides the new site CTA without create capability", async () => {
    mockUseUserCapabilities.mockReturnValue({
      actions: {
        sites: { create: false, update: false, delete: false },
      },
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("link", { name: /new site/i })
    ).not.toBeInTheDocument();
  });

  it("should have links to site detail pages", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    const allLinks = screen.getAllByRole("link");
    const siteLinks = allLinks.filter((link) =>
      link.getAttribute("href")?.includes("/sites/site")
    );
    expect(siteLinks.length).toBeGreaterThan(0);
    expect(siteLinks[0]).toHaveAttribute("href", "/sites/site-1");
  });

  it("should handle pagination", async () => {
    const paginatedResponse: PaginatedResponse<Site> = {
      ...mockResponse,
      meta: {
        current_page: 1,
        last_page: 3,
        per_page: 15,
        total: 45,
      },
    };
    vi.mocked(customersApi.listSites).mockResolvedValue(paginatedResponse);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Check pagination buttons are present
    const allButtons = screen.getAllByRole("button");
    const prevButtons = allButtons.filter((btn) =>
      btn.textContent?.match(/previous/i)
    );
    const nextButtons = allButtons.filter((btn) =>
      btn.textContent?.match(/next/i)
    );

    expect(prevButtons.length).toBeGreaterThan(0);
    expect(nextButtons.length).toBeGreaterThan(0);

    // Next button should be enabled
    expect(nextButtons[0]).not.toBeDisabled();

    // Previous button should be disabled on first page
    expect(prevButtons[0]).toBeDisabled();
  });

  it("should change page when pagination buttons are clicked", async () => {
    const paginatedResponse: PaginatedResponse<Site> = {
      ...mockResponse,
      meta: {
        current_page: 1,
        last_page: 3,
        per_page: 15,
        total: 45,
      },
    };
    vi.mocked(customersApi.listSites)
      .mockResolvedValueOnce(paginatedResponse)
      .mockImplementationOnce(
        () =>
          new Promise<Awaited<ReturnType<typeof customersApi.listSites>>>(
            () => {}
          )
      );

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    const allButtons = screen.getAllByRole("button");
    const nextButton = allButtons.find((btn) =>
      btn.textContent?.match(/next/i)
    )!;
    fireEvent.click(nextButton);

    expect(screen.getByText("Main Office")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: /loading sites table/i })
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(customersApi.listSites).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });

  it("should display pagination info correctly", async () => {
    const paginatedResponse: PaginatedResponse<Site> = {
      ...mockResponse,
      meta: {
        current_page: 1,
        last_page: 3,
        per_page: 15,
        total: 45,
      },
    };
    vi.mocked(customersApi.listSites).mockResolvedValue(paginatedResponse);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/showing/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/showing/i).closest("p")).toHaveTextContent(
      /of 45 sites/i
    );
  });

  it("should reset page to 1 when searching", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search sites/i);
    fireEvent.change(searchInput, { target: { value: "Project" } });

    await waitFor(() => {
      expect(customersApi.listSites).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Project", page: 1 })
      );
    });
  });

  it("should reset page to 1 when changing type filter", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    // Clear call history to isolate this test's API calls
    vi.mocked(customersApi.listSites).mockClear();

    await selectRadixOption(/type/i, /temporary/i);

    await waitFor(() => {
      expect(customersApi.listSites).toHaveBeenCalledWith(
        expect.objectContaining({ type: "temporary", page: 1 })
      );
    });
  });

  it("should reset page to 1 when changing status filter", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    await selectRadixOption(/status/i, /inactive/i);

    await waitFor(() => {
      expect(customersApi.listSites).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false, page: 1 })
      );
    });
  });
});
