// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import CustomerDetail from "./CustomerDetail";
import * as customersApi from "../../services/customersApi";

vi.mock("../../services/customersApi");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Renders CustomerDetail with mocked router context
// @ts-expect-error - id parameter kept for signature consistency but not used in mocked router
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function renderWithRouter(id: string) {
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <Routes>
          <Route path="/customers/:id" element={<CustomerDetail />} />
        </Routes>
      </I18nProvider>
    </BrowserRouter>
  );
}

describe("CustomerDetail", () => {
  const mockCustomer = {
    id: "customer-123",
    name: "Test Customer GmbH",
    customer_number: "CUST-2025-001",
    billing_address: {
      street: "Teststrasse 42",
      city: "München",
      postal_code: "80331",
      country: "DE",
    },
    contact: {
      name: "Max Mustermann",
      email: "max@test-customer.de",
      phone: "+49 89 12345678",
    },
    notes: "Important VIP customer",
    is_active: true,
    sites_count: 5,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-20T15:30:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/customers/customer-123");
  });

  it("loads and displays customer details", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(customersApi.getCustomer).toHaveBeenCalledWith("customer-123");
    });

    expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    expect(screen.getByText("CUST-2025-001")).toBeInTheDocument();
    expect(screen.getByText("Teststrasse 42")).toBeInTheDocument();
    expect(screen.getByText("80331 München")).toBeInTheDocument();
    expect(screen.getByText("DE")).toBeInTheDocument();
  });

  it("displays contact information", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText("Max Mustermann")).toBeInTheDocument();
    });

    expect(screen.getByText("max@test-customer.de")).toBeInTheDocument();
    expect(screen.getByText("+49 89 12345678")).toBeInTheDocument();
  });

  it("displays notes", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText("Important VIP customer")).toBeInTheDocument();
    });
  });

  it("displays sites count", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText(/This customer has 5 site/)).toBeInTheDocument();
    });
  });

  it("displays active status badge", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });
  });

  it("displays inactive status for inactive customers", async () => {
    const inactiveCustomer = { ...mockCustomer, is_active: false };
    vi.mocked(customersApi.getCustomer).mockResolvedValue(inactiveCustomer);

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText(/inactive/i)).toBeInTheDocument();
    });
  });

  it("navigates to edit page when edit button clicked", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    const editLink = screen.getByRole("link", { name: /edit/i });
    expect(editLink).toHaveAttribute("href", "/customers/customer-123/edit");
  });

  it("shows delete confirmation dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await user.click(deleteButton);

    // Confirmation dialog should appear
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });
  });

  it("deletes customer when confirmed", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.deleteCustomer).mockResolvedValue(undefined);

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    // Click delete
    const deleteButton = screen.getByRole("button", { name: /^delete$/i });
    await user.click(deleteButton);

    // Wait for dialog to open and find confirm button
    const confirmButton = await screen.findByRole(
      "button",
      { name: /^delete$/i },
      { timeout: 3000 }
    );

    await user.click(confirmButton);

    await waitFor(() => {
      expect(customersApi.deleteCustomer).toHaveBeenCalledWith("customer-123");
    });

    expect(mockNavigate).toHaveBeenCalledWith("/customers");
  });

  it("does not delete when cancelled", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    // Click delete
    await user.click(screen.getByRole("button", { name: /delete/i }));

    // Cancel deletion
    const cancelButton = screen.getByRole("button", { name: /cancel|no/i });
    await user.click(cancelButton);

    expect(customersApi.deleteCustomer).not.toHaveBeenCalled();
  });

  it("displays error message on load failure", async () => {
    vi.mocked(customersApi.getCustomer).mockRejectedValue(
      new Error("Customer not found")
    );

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText(/customer not found/i)).toBeInTheDocument();
    });
  });

  it("displays error message on delete failure", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.deleteCustomer).mockRejectedValue(
      new Error("Cannot delete customer with active sites")
    );

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    const confirmButton = await screen.findByRole(
      "button",
      { name: /^delete$/i },
      { timeout: 3000 }
    );
    await user.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText(/cannot delete customer/i)).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("handles customer without contact", async () => {
    const customerWithoutContact = { ...mockCustomer, contact: null };
    vi.mocked(customersApi.getCustomer).mockResolvedValue(
      customerWithoutContact
    );

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    // Contact section should show "No contact" or be empty
    expect(screen.queryByText("Max Mustermann")).not.toBeInTheDocument();
  });

  it("handles customer without notes", async () => {
    const customerWithoutNotes = { ...mockCustomer, notes: null };
    vi.mocked(customersApi.getCustomer).mockResolvedValue(customerWithoutNotes);

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Important VIP customer")
    ).not.toBeInTheDocument();
  });

  it("links to sites filtered by customer", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    // Should have link to sites page with customer filter
    const sitesLink = screen.getByRole("link", { name: /view sites|sites/i });
    expect(sitesLink).toHaveAttribute(
      "href",
      expect.stringContaining("/sites")
    );
    expect(sitesLink).toHaveAttribute(
      "href",
      expect.stringContaining("customer-123")
    );
  });

  it("navigates back to list when back button clicked", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter("customer-123");

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    const backLink = screen.getByRole("link", { name: /back to list/i });
    expect(backLink).toHaveAttribute("href", "/customers");
  });

  it("displays loading state initially", () => {
    vi.mocked(customersApi.getCustomer).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithRouter("customer-123");

    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
