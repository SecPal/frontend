// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { CustomersPage } from "./CustomersPage";
import * as customersApi from "../../services/customersApi";
import type { Customer, CustomerListResponse } from "../../types/customers";

// Mock the customers API
vi.mock("../../services/customersApi");

// Helper to render with providers
const renderWithProviders = () => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>
        <CustomersPage />
      </MemoryRouter>
    </I18nProvider>
  );
};

const mockCustomers: Customer[] = [
  {
    id: "cust-1",
    customer_number: "C001",
    name: "Acme Corp",
    short_name: "ACME",
    legal_form: "GmbH",
    tax_id: "DE123456789",
    billing_address: {
      id: "addr-1",
      type: "billing",
      street: "Main St",
      house_number: "123",
      postal_code: "12345",
      city: "Berlin",
      state: "Berlin",
      country: "Germany",
    },
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "cust-2",
    customer_number: "C002",
    name: "Tech Solutions Ltd",
    short_name: "TECH",
    legal_form: "AG",
    tax_id: "DE987654321",
    billing_address: {
      id: "addr-2",
      type: "billing",
      street: "Tech Ave",
      house_number: "456",
      postal_code: "54321",
      city: "Munich",
      state: "Bavaria",
      country: "Germany",
    },
    is_active: true,
    created_at: "2024-12-01T00:00:00Z",
    updated_at: "2024-12-01T00:00:00Z",
  },
];

const mockResponse: CustomerListResponse = {
  data: mockCustomers,
  meta: {
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 2,
  },
};

describe("CustomersPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(customersApi.listCustomers).mockResolvedValue(mockResponse);
  });

  it("should render customers list with table", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /customers/i })
      ).toBeInTheDocument();
    });

    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("C001")).toBeInTheDocument();
    expect(screen.getByText("ACME")).toBeInTheDocument();
  });

  it("should display loading state initially", () => {
    renderWithProviders();
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("should handle API errors gracefully", async () => {
    vi.mocked(customersApi.listCustomers).mockRejectedValue(
      new Error("API Error")
    );

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/failed to load customers/i)).toBeInTheDocument();
    });
  });

  it("should filter customers by search term", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search customers/i);
    fireEvent.change(searchInput, { target: { value: "Acme" } });

    await waitFor(() => {
      expect(customersApi.listCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Acme" })
      );
    });
  });

  it("should filter customers by status", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    const statusSelect = screen.getByRole("combobox", { name: /status/i });
    fireEvent.change(statusSelect, { target: { value: "false" } });

    await waitFor(() => {
      expect(customersApi.listCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false })
      );
    });
  });

  it("should display customer details correctly", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    // Check all customer fields are displayed
    expect(screen.getByText("C001")).toBeInTheDocument();
    expect(screen.getByText("ACME")).toBeInTheDocument();
    expect(screen.getByText("Berlin, Germany")).toBeInTheDocument();
    expect(screen.getAllByText(/active/i).length).toBeGreaterThan(0);
  });

  it("should display badge for active status", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    const activeBadges = screen.getAllByText(/active/i);
    expect(activeBadges.length).toBeGreaterThan(0);
  });

  it("should have link to new customer page", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/new customer/i)).toBeInTheDocument();
    });

    const newButton = screen.getByText(/new customer/i);
    expect(newButton.closest("a")).toHaveAttribute("href", "/customers/new");
  });

  it("should have links to customer detail pages", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    const customerLinks = screen.getAllByRole("link", { name: /acme corp/i });
    expect(customerLinks.length).toBeGreaterThan(0);
    expect(customerLinks[0]).toHaveAttribute("href", "/customers/cust-1");
  });

  it("should handle pagination", async () => {
    const paginatedResponse: CustomerListResponse = {
      ...mockResponse,
      meta: {
        current_page: 1,
        last_page: 3,
        per_page: 15,
        total: 45,
      },
    };
    vi.mocked(customersApi.listCustomers).mockResolvedValue(paginatedResponse);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
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
    const paginatedResponse: CustomerListResponse = {
      ...mockResponse,
      meta: {
        current_page: 1,
        last_page: 3,
        per_page: 15,
        total: 45,
      },
    };
    vi.mocked(customersApi.listCustomers).mockResolvedValue(paginatedResponse);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    const nextButton = screen.getByText(/next/i);
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(customersApi.listCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });

  it("should display pagination info correctly", async () => {
    const paginatedResponse: CustomerListResponse = {
      ...mockResponse,
      meta: {
        current_page: 1,
        last_page: 3,
        per_page: 15,
        total: 45,
      },
    };
    vi.mocked(customersApi.listCustomers).mockResolvedValue(paginatedResponse);

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/showing/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/1.*15.*45.*customers/i)).toBeInTheDocument();
  });

  it("should reset page to 1 when searching", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search customers/i);
    fireEvent.change(searchInput, { target: { value: "Tech" } });

    await waitFor(() => {
      expect(customersApi.listCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ search: "Tech", page: 1 })
      );
    });
  });

  it("should reset page to 1 when changing status filter", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    const statusSelect = screen.getByRole("combobox", { name: /status/i });
    fireEvent.change(statusSelect, { target: { value: "false" } });

    await waitFor(() => {
      expect(customersApi.listCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ is_active: false, page: 1 })
      );
    });
  });
});
