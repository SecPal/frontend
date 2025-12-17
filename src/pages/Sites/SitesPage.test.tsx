// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import SitesPage from "./SitesPage";
import * as customersApi from "../../services/customersApi";
import type { Site, PaginatedResponse } from "../../types/customers";

// Mock the customers API
vi.mock("../../services/customersApi");

// Helper to render with providers
const renderWithProviders = () => {  // Initialize i18n for tests
  i18n.load("en", {});
  i18n.activate("en");
    return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>
        <SitesPage />
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
    organizational_unit_id: "unit-1",
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
    organizational_unit_id: "unit-2",
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

describe("SitesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(customersApi.listSites).mockResolvedValue(mockResponse);
  });

  it("should render sites list with table", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /sites/i })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Main Office")).toBeInTheDocument();
    expect(screen.getByText("S001")).toBeInTheDocument();
  });

  it("should display loading state initially", () => {
    renderWithProviders();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("should handle API errors gracefully", async () => {
    vi.mocked(customersApi.listSites).mockRejectedValue(new Error("API Error"));

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/failed to load sites/i)).toBeInTheDocument();
    });
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

  it("should filter sites by type", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    const typeSelect = screen.getByRole("combobox", { name: /type/i });
    fireEvent.change(typeSelect, { target: { value: "permanent" } });

    await waitFor(() => {
      expect(customersApi.listSites).toHaveBeenCalledWith(
        expect.objectContaining({ site_type: "permanent" })
      );
    });
  });

  it("should filter sites by status", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    const statusSelect = screen.getByRole("combobox", { name: /status/i });
    fireEvent.change(statusSelect, { target: { value: "false" } });

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
    expect(screen.getByText("Berlin, Germany")).toBeInTheDocument();
    expect(screen.getByText("Munich, Germany")).toBeInTheDocument();
    expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
  });

  it("should display badge for site type", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    expect(screen.getByText(/permanent/i)).toBeInTheDocument();
    expect(screen.getByText(/temporary/i)).toBeInTheDocument();
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

  it("should have links to site detail pages", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    const siteLinks = screen.getAllByRole("link", { name: /main office/i });
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
    expect(screen.getByText(/previous/i)).toBeInTheDocument();
    expect(screen.getByText(/next/i)).toBeInTheDocument();

    // Next button should be enabled
    const nextButton = screen.getByText(/next/i);
    expect(nextButton).not.toBeDisabled();

    // Previous button should be disabled on first page
    const prevButton = screen.getByText(/previous/i);
    expect(prevButton).toBeDisabled();
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
    vi.mocked(customersApi.listSites).mockResolvedValue(paginatedResponse);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    const nextButton = screen.getByText(/next/i);
    fireEvent.click(nextButton);

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

    expect(screen.getByText(/1.*15.*45.*sites/i)).toBeInTheDocument();
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

    const typeSelect = screen.getByRole("combobox", { name: /type/i });
    fireEvent.change(typeSelect, { target: { value: "temporary" } });

    await waitFor(() => {
      expect(customersApi.listSites).toHaveBeenCalledWith(
        expect.objectContaining({ site_type: "temporary", page: 1 })
      );
    });
  });

  it("should reset page to 1 when changing status filter", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Main Office")).toBeInTheDocument();
    });

    const statusSelect = screen.getByRole("combobox", { name: /status/i });
    fireEvent.change(statusSelect, { target: { value: "false" } });

    await waitFor(() => {
      expect(customersApi.listSites).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false, page: 1 })
      );
    });
  });
});
