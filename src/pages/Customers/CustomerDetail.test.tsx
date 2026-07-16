// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import CustomerDetail from "./CustomerDetail";
import * as customersApi from "../../services/customersApi";
import { messages as deMessages } from "../../locales/de/messages.mjs";
import { messages as enMessages } from "../../locales/en/messages.mjs";

const { mockUseUserCapabilities } = vi.hoisted(() => ({
  mockUseUserCapabilities: vi.fn(),
}));

vi.mock("../../services/customersApi");
vi.mock("../../hooks/useUserCapabilities", () => ({
  useUserCapabilities: mockUseUserCapabilities,
}));

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Renders CustomerDetail with mocked router context
function renderWithRouter() {
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

function expectNoUnsafeContactHrefs(container: HTMLElement) {
  const contactHrefs = Array.from(
    container.querySelectorAll<HTMLAnchorElement>(
      'a[href^="mailto:"], a[href^="tel:"]'
    )
  ).map((anchor) => anchor.getAttribute("href") ?? "");

  expect(contactHrefs).not.toEqual(
    expect.arrayContaining([
      expect.stringMatching(/^(?:mailto|tel):.*[?&#\n\r]/),
    ])
  );
}

describe("CustomerDetail", () => {
  const mockCustomer = {
    id: "customer-123",
    name: "Test Customer GmbH",
    customer_number: "CUST-2025-001",
    legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
    vat_id: "DE123456789",
    billing_address: {
      street: "Teststrasse 42",
      city: "München",
      postal_code: "80331",
      country: "DE",
    },
    establishment_relationships: [
      {
        id: "relationship-123",
        customer_id: "customer-123",
        establishment_id: "establishment-123",
        establishment: {
          id: "establishment-123",
          name: "Munich Establishment",
        },
        contact: {
          name: "Max Mustermann",
          email: "max@test-customer.de",
          phone: "+49 89 12345678",
        },
        notes: "Important VIP customer",
        created_at: "2025-01-15T10:00:00Z",
        updated_at: "2025-01-20T15:30:00Z",
      },
    ],
    is_active: true,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-20T15:30:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    i18n.load("de", deMessages);
    i18n.load("en", enMessages);
    i18n.activate("en");
    window.history.pushState({}, "", "/customers/customer-123");
    mockUseUserCapabilities.mockReturnValue({
      actions: {
        customers: { create: true, update: true, delete: true },
      },
    });
  });

  it("loads and displays customer details", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    expect(customersApi.getCustomer).toHaveBeenCalledWith("customer-123");
    expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    expect(screen.getByText("CUST-2025-001")).toBeInTheDocument();
    expect(screen.getByText("Teststrasse 42")).toBeInTheDocument();
    expect(screen.getByText("80331")).toBeInTheDocument();
    expect(screen.getByText("München")).toBeInTheDocument();
    expect(screen.getByText("DE")).toBeInTheDocument();
    expect(screen.getByText("VAT ID")).toBeInTheDocument();
    expect(screen.getByText("DE123456789")).toBeInTheDocument();
  });

  it("uses the full shell width without an extra detail-page max width", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    const { container } = renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    expect(container.firstElementChild).toHaveClass("w-full");
    expect(container.firstElementChild).not.toHaveClass("max-w-4xl");
  });

  it("renders postal code and city on separate billing-address lines", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    expect(screen.getByText("Postal Code")).toBeInTheDocument();
    expect(screen.getByText("City")).toBeInTheDocument();
    expect(screen.getByText("80331")).toBeInTheDocument();
    expect(screen.getByText("München")).toBeInTheDocument();
    expect(screen.queryByText("80331 München")).not.toBeInTheDocument();
  });

  it("displays contact information", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Max Mustermann")).toBeInTheDocument();
    });

    expect(screen.getByText("max@test-customer.de")).toBeInTheDocument();
    expect(screen.getByText("+49 89 12345678")).toBeInTheDocument();
    expect(
      screen.getByText("max@test-customer.de").closest("a")
    ).toHaveAttribute("href", "mailto:max@test-customer.de");
    expect(screen.getByText("+49 89 12345678").closest("a")).toHaveAttribute(
      "href",
      "tel:+49 89 12345678"
    );
  });

  it("renders unsafe contact email and phone as plain text", async () => {
    const unsafeCustomer = {
      ...mockCustomer,
      establishment_relationships: mockCustomer.establishment_relationships.map(
        (relationship) => ({
          ...relationship,
          contact: {
            ...relationship.contact,
            email: "target@example.com?bcc=attacker@evil.com&subject=PWN",
            phone: "+49?suffix=evil",
          },
        })
      ),
    };
    vi.mocked(customersApi.getCustomer).mockResolvedValue(unsafeCustomer);

    const { container } = renderWithRouter();

    await waitFor(() => {
      expect(
        screen.getByText(
          unsafeCustomer.establishment_relationships[0]!.contact.email
        )
      ).toBeInTheDocument();
    });

    expect(
      screen
        .getByText(unsafeCustomer.establishment_relationships[0]!.contact.email)
        .closest("a")
    ).toBeNull();
    expect(
      screen
        .getByText(unsafeCustomer.establishment_relationships[0]!.contact.phone)
        .closest("a")
    ).toBeNull();
    expectNoUnsafeContactHrefs(container);
  });

  it("displays notes", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Important VIP customer")).toBeInTheDocument();
    });
  });

  it("shows shared master data once and each visible establishment with its own relationship data", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue({
      ...mockCustomer,
      establishment_relationships: [
        ...mockCustomer.establishment_relationships,
        {
          id: "relationship-456",
          customer_id: mockCustomer.id,
          establishment_id: "establishment-456",
          establishment: {
            id: "establishment-456",
            name: "Berlin Establishment",
          },
          contact: {
            name: "Berlin Contact",
            email: "berlin@test-customer.de",
            phone: "+49 30 12345678",
          },
          notes: "Berlin-only note",
          created_at: "2026-07-16T00:00:00Z",
          updated_at: "2026-07-16T00:00:00Z",
        },
      ],
    });

    renderWithRouter();

    expect(
      (await screen.findAllByText("Berlin Establishment")).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Munich Establishment").length).toBeGreaterThan(
      0
    );
    expect(screen.getByText("Max Mustermann")).toBeInTheDocument();
    expect(screen.getByText("Important VIP customer")).toBeInTheDocument();
    expect(screen.getByText("Berlin Contact")).toBeInTheDocument();
    expect(screen.getByText("Berlin-only note")).toBeInTheDocument();
    expect(screen.getAllByText("Billing Address")).toHaveLength(1);
    expect(screen.getAllByText("Teststrasse 42")).toHaveLength(1);
  });

  it("displays active status badge", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/active/i)).toBeInTheDocument();
    });
  });

  it("displays inactive status for inactive customers", async () => {
    const inactiveCustomer = { ...mockCustomer, is_active: false };
    vi.mocked(customersApi.getCustomer).mockResolvedValue(inactiveCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/inactive/i)).toBeInTheDocument();
    });
  });

  it("displays the legal entity identifier supplied by the customer response", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    expect(
      await screen.findByText(mockCustomer.legal_entity_id)
    ).toBeInTheDocument();
  });

  it("does not invent an assignment for an unmigrated customer", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue({
      ...mockCustomer,
      legal_entity_id: undefined,
    } as unknown as typeof mockCustomer);

    renderWithRouter();

    expect(
      await screen.findByText(/requires a legal entity assignment/i)
    ).toBeInTheDocument();
  });

  it("navigates to edit page when edit button clicked", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    const editLink = screen.getByRole("link", { name: /edit/i });
    expect(editLink).toHaveAttribute("href", "/customers/customer-123/edit");
  });

  it("shows delete confirmation dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

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

    renderWithRouter();

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

    renderWithRouter();

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

    renderWithRouter();

    const loadError = await screen.findByText(/customer not found/i);
    expect(loadError).toBeInTheDocument();
    expect(loadError.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
  });

  it("keeps detail heading secondary text and destructive states on canonical theme tokens", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    const customerNumber = await screen.findByText("CUST-2025-001");
    expect(customerNumber).toHaveClass("text-muted-foreground");
  });

  it("displays error message on delete failure", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.deleteCustomer).mockRejectedValue(
      new Error("Cannot delete customer with active sites")
    );

    renderWithRouter();

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
    const customerWithoutContact = {
      ...mockCustomer,
      establishment_relationships: mockCustomer.establishment_relationships.map(
        (relationship) => ({ ...relationship, contact: null })
      ),
    };
    vi.mocked(customersApi.getCustomer).mockResolvedValue(
      customerWithoutContact
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    // Contact section should show "No contact" or be empty
    expect(screen.queryByText("Max Mustermann")).not.toBeInTheDocument();
  });

  it("handles customer without notes", async () => {
    const customerWithoutNotes = {
      ...mockCustomer,
      establishment_relationships: mockCustomer.establishment_relationships.map(
        (relationship) => ({ ...relationship, notes: null })
      ),
    };
    vi.mocked(customersApi.getCustomer).mockResolvedValue(customerWithoutNotes);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    expect(
      screen.queryByText("Important VIP customer")
    ).not.toBeInTheDocument();
  });

  it("links to sites filtered by customer", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    const sitesLink = screen.getByRole("link", {
      name: /view sites|sites/i,
    });
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

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    const backLink = screen.getByRole("link", { name: /back to list/i });
    expect(backLink).toHaveAttribute("href", "/customers");
  });

  it("hides edit and delete actions without management capabilities", async () => {
    mockUseUserCapabilities.mockReturnValue({
      actions: {
        customers: { create: false, update: false, delete: false },
      },
    });
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("link", { name: /edit/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^delete$/i })
    ).not.toBeInTheDocument();
  });

  it("displays loading state initially", () => {
    vi.mocked(customersApi.getCustomer).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithRouter();

    // Only the first section skeleton announces; the other two are
    // decorative so assistive tech does not stack identical "Loading
    // customer details" live regions at the same time.
    expect(
      screen.getAllByRole("status", { name: "Loading customer details" })
    ).toHaveLength(1);
    expect(
      screen.getByRole("heading", { name: "Customer" })
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to list/i })).toHaveAttribute(
      "href",
      "/customers"
    );
    expect(screen.queryByText(/^Loading\.\.\.$/i)).not.toBeInTheDocument();
  });

  it("ignores a late-resolving fetch for the previous customer after navigating to a new id", async () => {
    const customerA = {
      ...mockCustomer,
      id: "customer-A",
      name: "Customer A",
      customer_number: "CUST-A",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
    };
    const customerB = {
      ...mockCustomer,
      id: "customer-B",
      name: "Customer B",
      customer_number: "CUST-B",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
    };

    let resolveCustomerA:
      | ((
          customer: Awaited<ReturnType<typeof customersApi.getCustomer>>
        ) => void)
      | undefined;
    vi.mocked(customersApi.getCustomer).mockImplementation(async (id) => {
      if (id === "customer-A") {
        return new Promise((resolve) => {
          resolveCustomerA = resolve;
        });
      }
      return customerB;
    });

    window.history.pushState({}, "", "/customers/customer-A");
    renderWithRouter();

    // While A is still pending, navigate to B which resolves quickly.
    await act(async () => {
      window.history.pushState({}, "", "/customers/customer-B");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("Customer B")).toBeInTheDocument();
    });

    // The lagging A fetch now resolves. Without a cancellation guard,
    // its `setCustomer(customerA)` would clobber B and the URL would
    // disagree with the rendered record — so destructive actions (Edit,
    // Delete) would target Customer A even though the user is on
    // `/customers/customer-B`.
    await act(async () => {
      resolveCustomerA?.(customerA);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Customer B")).toBeInTheDocument();
    expect(screen.queryByText("Customer A")).not.toBeInTheDocument();
    expect(screen.queryByText("CUST-A")).not.toBeInTheDocument();
  });

  it("hides the previous customer's details when navigating between /customers/:id routes", async () => {
    const customerA = {
      ...mockCustomer,
      id: "customer-A",
      name: "Customer A",
      customer_number: "CUST-A",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
    };
    const customerB = {
      ...mockCustomer,
      id: "customer-B",
      name: "Customer B",
      customer_number: "CUST-B",
      legal_entity_id: "550e8400-e29b-41d4-a716-446655440001",
    };

    let resolveCustomerB:
      | ((
          customer: Awaited<ReturnType<typeof customersApi.getCustomer>>
        ) => void)
      | undefined;
    vi.mocked(customersApi.getCustomer).mockImplementation(async (id) => {
      if (id === "customer-A") {
        return customerA;
      }
      return new Promise((resolve) => {
        resolveCustomerB = resolve;
      });
    });

    window.history.pushState({}, "", "/customers/customer-A");
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Customer A")).toBeInTheDocument();
    });

    // Param-only navigation between `/customers/:id` routes. React Router
    // reuses the same `CustomerDetail` instance, so without the in-effect
    // reset the previous customer's name, customer_number and Delete
    // button would stay visible under the new URL until the new fetch
    // resolved.
    await act(async () => {
      window.history.pushState({}, "", "/customers/customer-B");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: "Loading customer details" })
      ).toBeInTheDocument();
    });
    expect(screen.queryByText("Customer A")).not.toBeInTheDocument();
    expect(screen.queryByText("CUST-A")).not.toBeInTheDocument();

    await act(async () => {
      resolveCustomerB?.(customerB);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("Customer B")).toBeInTheDocument();
    });
  });
});
