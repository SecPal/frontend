// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { CustomersPage } from "./CustomersPage";
import * as customerApi from "../../services/customerApi";
import type { Customer } from "../../types";

// Mock the API
vi.mock("../../services/customerApi", () => ({
  listCustomers: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useNavigate: () => mockNavigate,
  };
});

// Helper to render with providers
const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{component}</MemoryRouter>
    </I18nProvider>
  );
};

describe("CustomersPage", () => {
  const mockCustomers: Customer[] = [
    {
      id: "cust-1",
      name: "Acme Corp",
      customer_number: "CUST-001",
      type: "corporate",
      contact_email: "info@acme.com",
      contact_phone: "+49 123 456789",
      address: "123 Main St\nBerlin, Germany",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "cust-2",
      name: "TechStart GmbH",
      customer_number: "CUST-002",
      type: "local",
      created_at: "2025-01-02T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(customerApi.listCustomers).mockResolvedValue({
      data: mockCustomers,
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 2 },
    });
  });

  it("renders page heading", async () => {
    renderWithProviders(<CustomersPage />);

    expect(screen.getByText("Customers")).toBeInTheDocument();
  });

  it("renders page description", async () => {
    renderWithProviders(<CustomersPage />);

    expect(
      screen.getByText(/Manage customer organizations/)
    ).toBeInTheDocument();
  });

  it("shows placeholder when no customer is selected", async () => {
    renderWithProviders(<CustomersPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Select a customer to view details")
      ).toBeInTheDocument();
    });
  });

  it("loads customers on mount", async () => {
    renderWithProviders(<CustomersPage />);

    await waitFor(() => {
      expect(customerApi.listCustomers).toHaveBeenCalledWith({ per_page: 100 });
    });
  });

  it("displays customer in tree", async () => {
    renderWithProviders(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
      expect(screen.getByText("TechStart GmbH")).toBeInTheDocument();
    });
  });

  it("displays customer details when selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Acme Corp"));

    await waitFor(() => {
      expect(screen.getByText("Customer Number")).toBeInTheDocument();
      // CUST-001 appears twice: once in tree (span), once in detail panel (dd)
      expect(screen.getAllByText("CUST-001")).toHaveLength(2);
    });
  });

  it("displays contact email when available", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Acme Corp"));

    await waitFor(() => {
      expect(screen.getByText("Contact Email")).toBeInTheDocument();
      expect(screen.getByText("info@acme.com")).toBeInTheDocument();
    });
  });

  it("displays contact phone when available", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Acme Corp"));

    await waitFor(() => {
      expect(screen.getByText("Contact Phone")).toBeInTheDocument();
      expect(screen.getByText("+49 123 456789")).toBeInTheDocument();
    });
  });

  it("displays address when available", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Acme Corp"));

    await waitFor(() => {
      expect(screen.getByText("Address")).toBeInTheDocument();
    });
  });

  it("shows View Objects button when customer is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Acme Corp"));

    await waitFor(() => {
      expect(screen.getByText("View Objects")).toBeInTheDocument();
    });
  });

  it("navigates to objects page when View Objects is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersPage />);

    await waitFor(() => {
      expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    });

    await user.click(screen.getByText("Acme Corp"));

    await waitFor(() => {
      expect(screen.getByText("View Objects")).toBeInTheDocument();
    });

    await user.click(screen.getByText("View Objects"));

    expect(mockNavigate).toHaveBeenCalledWith("/customers/cust-1/objects");
  });
});
