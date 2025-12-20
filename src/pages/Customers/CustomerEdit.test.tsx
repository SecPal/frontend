// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import CustomerEdit from "./CustomerEdit";
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
      email: "jane@example.com",
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

    expect(screen.getByLabelText(/customer name/i)).toHaveValue(
      "Existing Customer"
    );
    expect(screen.getByLabelText(/street/i)).toHaveValue("Old Street 10");
    expect(screen.getByLabelText(/city/i)).toHaveValue("Old City");
    expect(screen.getByLabelText(/postal code/i)).toHaveValue("54321");
    expect(screen.getByLabelText(/country/i)).toHaveValue("DE");
    expect(screen.getByLabelText(/notes/i)).toHaveValue("Existing notes");
  });

  it("loads contact information", async () => {
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter();

    await waitFor(() => {
      const contactNameInput = screen.getByRole("textbox", { name: /^name$/i });
      expect(contactNameInput).toHaveValue("Jane Doe");
    });

    expect(screen.getByLabelText(/email/i)).toHaveValue("jane@example.com");
    expect(screen.getByLabelText(/phone/i)).toHaveValue("+49 987 654321");
  });

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
    await user.clear(nameInput);
    await user.type(nameInput, "Updated Customer");

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
    await user.clear(streetInput);
    await user.type(streetInput, "New Street 20");

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
      expect(screen.getByLabelText(/email/i)).toHaveValue("jane@example.com");
    });

    // Modify email
    const emailInput = screen.getByLabelText(/email/i);
    await user.clear(emailInput);
    await user.type(emailInput, "newemail@example.com");

    await user.click(screen.getByRole("button", { name: /save|update/i }));

    await waitFor(() => {
      expect(customersApi.updateCustomer).toHaveBeenCalledWith(
        "customer-123",
        expect.objectContaining({
          contact: expect.objectContaining({
            email: "newemail@example.com",
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

    await waitFor(() => {
      expect(screen.getByText(/customer not found/i)).toBeInTheDocument();
    });
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
