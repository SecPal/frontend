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
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import CustomerEdit from "./CustomerEdit";
import * as customersApi from "../../services/customersApi";

vi.mock("../../services/customersApi");

const SLOW_TEST_TIMEOUT = 20000;

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Renders CustomerEdit with mocked router context
function renderWithRouter() {
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <Routes>
          <Route path="/customers/:id/edit" element={<CustomerEdit />} />
        </Routes>
      </I18nProvider>
    </BrowserRouter>,
    { wrapper: undefined }
  );
}

describe("CustomerEdit", () => {
  const mockCustomer = {
    id: "customer-123",
    name: "Existing Customer",
    customer_number: "CUST-2025-001",
    billing_address: {
      street: "Old Street 10",
      city: "Old City",
      postal_code: "54321",
      country: "DE",
    },
    contact: {
      name: "Jane Doe",
      email: "jane@secpal.dev",
      phone: "+49 987 654321",
    },
    notes: "Existing notes",
    is_active: true,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/customers/customer-123/edit");
  });

  it("loads and displays customer data", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(customersApi.getCustomer).toHaveBeenCalledWith("customer-123");
    });

    expect(await screen.findByLabelText(/customer name/i)).toHaveValue(
      "Existing Customer"
    );
    expect(screen.getByLabelText(/street/i)).toHaveValue("Old Street 10");
    expect(screen.getByLabelText(/city/i)).toHaveValue("Old City");
    expect(screen.getByLabelText(/postal code/i)).toHaveValue("54321");
    expect(screen.getByLabelText(/country/i)).toHaveValue("DE");
    expect(screen.getByLabelText(/notes/i)).toHaveValue("Existing notes");
  });

  it("keeps the edit frame visible while customer data loads", () => {
    vi.mocked(customersApi.getCustomer).mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof customersApi.getCustomer>>>(
          () => {}
        )
    );

    renderWithRouter();

    expect(
      screen.getByRole("heading", { name: /edit customer/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading customer form" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Loading\.\.\.$/i)).not.toBeInTheDocument();
  });

  it(
    "loads contact information",
    async () => {
      vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/customer name/i)).toHaveValue(
          "Existing Customer"
        );
      });

      expect(screen.getByRole("textbox", { name: /^name$/i })).toHaveValue(
        "Jane Doe"
      );
      expect(screen.getByLabelText(/email/i)).toHaveValue("jane@secpal.dev");
      expect(screen.getByLabelText(/phone/i)).toHaveValue("+49 987 654321");
    },
    SLOW_TEST_TIMEOUT
  );

  it("updates customer with modified data", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockResolvedValue({
      ...mockCustomer,
      name: "Updated Customer",
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue(
        "Existing Customer"
      );
    });

    // Modify name
    const nameInput = screen.getByLabelText(/customer name/i);
    fireEvent.change(nameInput, {
      target: { value: "Updated Customer" },
    });

    // Submit
    await user.click(screen.getByRole("button", { name: /save|update/i }));

    await waitFor(() => {
      expect(customersApi.updateCustomer).toHaveBeenCalledWith(
        "customer-123",
        expect.objectContaining({
          name: "Updated Customer",
        })
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith("/customers/customer-123");
  });

  it("updates billing address", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/street/i)).toHaveValue("Old Street 10");
    });

    // Modify street
    const streetInput = screen.getByLabelText(/street/i);
    fireEvent.change(streetInput, {
      target: { value: "New Street 20" },
    });

    await user.click(screen.getByRole("button", { name: /save|update/i }));

    await waitFor(() => {
      expect(customersApi.updateCustomer).toHaveBeenCalledWith(
        "customer-123",
        expect.objectContaining({
          billing_address: expect.objectContaining({
            street: "New Street 20",
          }),
        })
      );
    });
  });

  it("updates contact information", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/email/i)).toHaveValue("jane@secpal.dev");
    });

    // Modify email
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, {
      target: { value: "newemail@secpal.dev" },
    });

    await user.click(screen.getByRole("button", { name: /save|update/i }));

    await waitFor(() => {
      expect(customersApi.updateCustomer).toHaveBeenCalledWith(
        "customer-123",
        expect.objectContaining({
          contact: expect.objectContaining({
            email: "newemail@secpal.dev",
          }),
        })
      );
    });
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

  it("keeps load and submit errors on canonical theme tokens", async () => {
    vi.mocked(customersApi.getCustomer).mockRejectedValueOnce(
      new Error("Customer not found")
    );

    renderWithRouter();

    const loadError = await screen.findByText(/customer not found/i);
    expect(loadError.closest('[data-slot="alert"]')).toHaveClass(
      "text-foreground"
    );

    vi.clearAllMocks();
  });

  it("displays error message on update failure", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockRejectedValue(
      new Error("Update failed")
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue(
        "Existing Customer"
      );
    });

    await user.click(screen.getByRole("button", { name: /save|update/i }));

    await waitFor(() => {
      expect(screen.getByText(/update failed/i)).toBeInTheDocument();
    });

    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("navigates back on cancel", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue(
        "Existing Customer"
      );
    });

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/customers/customer-123");
  });

  it("disables submit button while saving", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue(
        "Existing Customer"
      );
    });

    const submitButton = screen.getByRole("button", { name: /save|update/i });
    await user.click(submitButton);

    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });

  it("handles customer without contact", async () => {
    const customerWithoutContact = {
      ...mockCustomer,
      contact: null,
    };

    vi.mocked(customersApi.getCustomer).mockResolvedValue(
      customerWithoutContact
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue(
        "Existing Customer"
      );
    });

    // Contact fields should be empty
    const contactNameInput = screen.getByRole("textbox", { name: /^name$/i });
    expect(contactNameInput).toHaveValue("");
    expect(screen.getByLabelText(/email/i)).toHaveValue("");
    expect(screen.getByLabelText(/phone/i)).toHaveValue("");
  });

  it("handles customer without notes", async () => {
    const customerWithoutNotes = {
      ...mockCustomer,
      notes: null,
    };

    vi.mocked(customersApi.getCustomer).mockResolvedValue(customerWithoutNotes);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/notes/i)).toHaveValue("");
    });
  });

  it("ignores a late-resolving fetch for the previous customer after navigating between /customers/:id/edit routes", async () => {
    const customerA = {
      ...mockCustomer,
      id: "customer-A",
      name: "Customer A",
      customer_number: "CUST-A",
    };
    const customerB = {
      ...mockCustomer,
      id: "customer-B",
      name: "Customer B",
      customer_number: "CUST-B",
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

    window.history.pushState({}, "", "/customers/customer-A/edit");
    renderWithRouter();

    // Navigate to B while A is still in flight. B resolves immediately.
    await act(async () => {
      window.history.pushState({}, "", "/customers/customer-B/edit");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue("Customer B");
    });

    // Late A resolution must NOT refill the form with Customer A's data.
    await act(async () => {
      resolveCustomerA?.(customerA);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText(/customer name/i)).toHaveValue("Customer B");
    expect(screen.queryByDisplayValue("Customer A")).not.toBeInTheDocument();
  });

  it("clears the previous customer's form when navigating between /customers/:id/edit routes", async () => {
    const customerA = {
      ...mockCustomer,
      id: "customer-A",
      name: "Customer A",
      customer_number: "CUST-A",
    };
    const customerB = {
      ...mockCustomer,
      id: "customer-B",
      name: "Customer B",
      customer_number: "CUST-B",
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

    window.history.pushState({}, "", "/customers/customer-A/edit");
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue("Customer A");
    });

    // Param-only navigation: same route pattern, different `:id`. React
    // Router keeps the same `CustomerEdit` instance and only updates the
    // params, so the load effect re-runs but the stored `customer` /
    // `formData` would otherwise still belong to Customer A.
    await act(async () => {
      window.history.pushState({}, "", "/customers/customer-B/edit");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: /loading customer form/i })
      ).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue("Customer A")).not.toBeInTheDocument();

    await act(async () => {
      resolveCustomerB?.(customerB);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/customer name/i)).toHaveValue("Customer B");
    });
  });

  it("toggles is_active checkbox", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(customersApi.updateCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/active/i)).toBeChecked();
    });

    // Toggle off
    await user.click(screen.getByLabelText(/active/i));

    await user.click(screen.getByRole("button", { name: /save|update/i }));

    await waitFor(() => {
      expect(customersApi.updateCustomer).toHaveBeenCalledWith(
        "customer-123",
        expect.objectContaining({
          is_active: false,
        })
      );
    });
  });
});
