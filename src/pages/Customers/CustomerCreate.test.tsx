// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import CustomerCreate from "./CustomerCreate";
import * as customersApi from "../../services/customersApi";

// Mock the API
vi.mock("../../services/customersApi");

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderWithRouter(component: React.ReactElement) {
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>{component}</I18nProvider>
    </BrowserRouter>
  );
}

describe("CustomerCreate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the form with all required fields", () => {
    renderWithRouter(<CustomerCreate />);

    expect(screen.getByLabelText(/customer name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/street/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/postal code/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/city/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/country/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create customer/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("renders contact fields", () => {
    renderWithRouter(<CustomerCreate />);

    expect(screen.getByLabelText(/^name$/i)).toBeInTheDocument(); // Contact name
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/phone/i)).toBeInTheDocument();
  });

  it("renders notes and active checkbox", () => {
    renderWithRouter(<CustomerCreate />);

    expect(screen.getByLabelText(/notes/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/active/i)).toBeInTheDocument();
  });

  it("submits form with valid data", async () => {
    const user = userEvent.setup();
    const mockCustomer = {
      id: "customer-123",
      name: "Test Customer",
      billing_address: {
        street: "Test Street 1",
        city: "Test City",
        postal_code: "12345",
        country: "DE",
      },
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(customersApi.createCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter(<CustomerCreate />);

    // Fill in required fields
    await user.type(screen.getByLabelText(/customer name/i), "Test Customer");
    await user.type(screen.getByLabelText(/street/i), "Test Street 1");
    await user.type(screen.getByLabelText(/postal code/i), "12345");
    await user.type(screen.getByLabelText(/city/i), "Test City");

    // Country should already be "DE" by default
    expect(screen.getByLabelText(/country/i)).toHaveValue("DE");

    // Submit form
    await user.click(screen.getByRole("button", { name: /create customer/i }));

    // Wait for API call
    await waitFor(() => {
      expect(customersApi.createCustomer).toHaveBeenCalledWith({
        name: "Test Customer",
        billing_address: {
          street: "Test Street 1",
          city: "Test City",
          postal_code: "12345",
          country: "DE",
        },
        is_active: true,
      });
    });

    // Should navigate to detail page
    expect(mockNavigate).toHaveBeenCalledWith("/customers/customer-123");
  });

  it("submits form with contact information", async () => {
    const user = userEvent.setup();
    const mockCustomer = {
      id: "customer-456",
      name: "Customer with Contact",
      billing_address: {
        street: "Street 1",
        city: "City",
        postal_code: "12345",
        country: "DE",
      },
      contact: {
        name: "John Doe",
        email: "john@example.com",
        phone: "+49 123 456789",
      },
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(customersApi.createCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter(<CustomerCreate />);

    // Fill required fields
    await user.type(
      screen.getByLabelText(/customer name/i),
      "Customer with Contact"
    );
    await user.type(screen.getByLabelText(/street/i), "Street 1");
    await user.type(screen.getByLabelText(/postal code/i), "12345");
    await user.type(screen.getByLabelText(/city/i), "City");

    // Fill contact fields using name attributes
    const contactNameInput = screen.getByRole("textbox", { name: /^name$/i });
    await user.type(contactNameInput, "John Doe");
    await user.type(
      screen.getByRole("textbox", { name: /email/i }),
      "john@example.com"
    );
    await user.type(
      screen.getByRole("textbox", { name: /phone/i }),
      "+49 123 456789"
    );

    // Submit
    await user.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() => {
      expect(customersApi.createCustomer).toHaveBeenCalledWith({
        name: "Customer with Contact",
        billing_address: {
          street: "Street 1",
          city: "City",
          postal_code: "12345",
          country: "DE",
        },
        contact: {
          name: "John Doe",
          email: "john@example.com",
          phone: "+49 123 456789",
        },
        is_active: true,
      });
    });
  });

  it("does not include contact if all fields are empty", async () => {
    const user = userEvent.setup();
    const mockCustomer = {
      id: "customer-789",
      name: "Customer without Contact",
      billing_address: {
        street: "Street 1",
        city: "City",
        postal_code: "12345",
        country: "DE",
      },
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(customersApi.createCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter(<CustomerCreate />);

    // Fill only required fields, leave contact empty
    await user.type(
      screen.getByLabelText(/customer name/i),
      "Customer without Contact"
    );
    await user.type(screen.getByLabelText(/street/i), "Street 1");
    await user.type(screen.getByLabelText(/postal code/i), "12345");
    await user.type(screen.getByLabelText(/city/i), "City");

    await user.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() => {
      const callArg = vi.mocked(customersApi.createCustomer).mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      expect(callArg?.contact).toBeUndefined();
    });
  });

  it("displays error message on API failure", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.createCustomer).mockRejectedValue(
      new Error("Server error: Failed to create customer")
    );

    renderWithRouter(<CustomerCreate />);

    // Fill and submit
    await user.type(screen.getByLabelText(/customer name/i), "Test");
    await user.type(screen.getByLabelText(/street/i), "Street");
    await user.type(screen.getByLabelText(/postal code/i), "12345");
    await user.type(screen.getByLabelText(/city/i), "City");
    await user.click(screen.getByRole("button", { name: /create customer/i }));

    // Should show error
    await waitFor(() => {
      expect(screen.getByText(/server error/i)).toBeInTheDocument();
    });

    // Should not navigate
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("displays validation errors", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.createCustomer).mockRejectedValue(
      new Error(
        "name: The name field is required.\nbilling_address.street: The billing street field is required."
      )
    );

    renderWithRouter(<CustomerCreate />);

    // Fill minimal required fields to bypass HTML5 validation
    await user.type(screen.getByLabelText(/customer name/i), "Test");
    await user.type(screen.getByLabelText(/street/i), "Street");
    await user.type(screen.getByLabelText(/postal code/i), "12345");
    await user.type(screen.getByLabelText(/city/i), "City");

    await user.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() => {
      // Error message should contain the validation errors
      expect(
        screen.getByText(/name: The name field is required/)
      ).toBeInTheDocument();
    });
  });

  it("converts country to uppercase", async () => {
    const user = userEvent.setup();
    const mockCustomer = {
      id: "customer-country",
      name: "Test",
      customer_number: "CUST-001",
      billing_address: {
        street: "Street",
        city: "City",
        postal_code: "12345",
        country: "DE",
      },
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(customersApi.createCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter(<CustomerCreate />);

    await user.type(screen.getByLabelText(/customer name/i), "Test");
    await user.type(screen.getByLabelText(/street/i), "Street");
    await user.type(screen.getByLabelText(/postal code/i), "12345");
    await user.type(screen.getByLabelText(/city/i), "City");

    // Clear default and type lowercase
    const countryInput = screen.getByLabelText(/country/i);
    await user.clear(countryInput);
    await user.type(countryInput, "de");

    // Should be converted to uppercase
    expect(countryInput).toHaveValue("DE");
  });

  it("includes notes when provided", async () => {
    const user = userEvent.setup();
    const mockCustomer = {
      id: "customer-notes",
      name: "Test",
      customer_number: "CUST-002",
      billing_address: {
        street: "Street",
        city: "City",
        postal_code: "12345",
        country: "DE",
      },
      notes: "Important customer",
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(customersApi.createCustomer).mockResolvedValue(mockCustomer);

    renderWithRouter(<CustomerCreate />);

    await user.type(screen.getByLabelText(/customer name/i), "Test");
    await user.type(screen.getByLabelText(/street/i), "Street");
    await user.type(screen.getByLabelText(/postal code/i), "12345");
    await user.type(screen.getByLabelText(/city/i), "City");
    await user.type(screen.getByLabelText(/notes/i), "Important customer");

    await user.click(screen.getByRole("button", { name: /create customer/i }));

    await waitFor(() => {
      const callArg = vi.mocked(customersApi.createCustomer).mock.calls[0]?.[0];
      expect(callArg).toBeDefined();
      expect(callArg?.notes).toBe("Important customer");
    });
  });

  it("navigates back on cancel", async () => {
    const user = userEvent.setup();
    renderWithRouter(<CustomerCreate />);

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(mockNavigate).toHaveBeenCalledWith("/customers");
  });

  it("disables submit button while loading", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.createCustomer).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 1000))
    );

    renderWithRouter(<CustomerCreate />);

    await user.type(screen.getByLabelText(/customer name/i), "Test");
    await user.type(screen.getByLabelText(/street/i), "Street");
    await user.type(screen.getByLabelText(/postal code/i), "12345");
    await user.type(screen.getByLabelText(/city/i), "City");

    const submitButton = screen.getByRole("button", {
      name: /create customer/i,
    });
    await user.click(submitButton);

    // Button should be disabled during submission
    expect(submitButton).toBeDisabled();
    expect(screen.getByText(/creating/i)).toBeInTheDocument();
  });
});
