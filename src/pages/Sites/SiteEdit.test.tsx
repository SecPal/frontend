// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import SiteEdit from "./SiteEdit";
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
      email: "john@secpal.dev",
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

  const mockUpdatedSite = {
    ...mockSite,
    name: "Updated site name",
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
  });

  it("loads site data and customers on mount", async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(customersApi.getSite).toHaveBeenCalledWith("site-123");
      expect(customersApi.listCustomers).toHaveBeenCalledWith({
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

  it("pre-selects correct customer", async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(
        screen.getByRole("combobox", { name: /customer/i })
      ).toHaveTextContent("C001 - Customer One");
    });

    expect(
      screen.queryByLabelText(/organizational unit/i)
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/type/i)).not.toBeInTheDocument();
  });

  it("keeps optional contact labels on canonical muted tokens", async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/site name/i)).toBeInTheDocument();
    });

    const optionalLabel = screen.getByText(/\(optional\)/i);
    expect(optionalLabel).toHaveClass("text-muted-foreground");
  });

  it(
    "updates site with modified data",
    async () => {
      vi.mocked(customersApi.updateSite).mockResolvedValue(mockUpdatedSite);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/site name/i)).toBeInTheDocument();
      });

      // Modify name
      const nameInput = screen.getByLabelText(/site name/i);
      fireEvent.change(nameInput, {
        target: { value: "Updated site name" },
      });

      // Submit
      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(customersApi.updateSite).toHaveBeenCalledWith("site-123", {
          customer_id: "customer-1",
          name: "Updated site name",
          address: {
            street: "Old Street 1",
            city: "Old City",
            postal_code: "11111",
            country: "DE",
          },
          contact: {
            name: "John Doe",
            email: "john@secpal.dev",
            phone: "+49 123 456789",
          },
        });
        expect(mockNavigate).toHaveBeenCalledWith("/sites/site-123");
      });
    },
    SLOW_TEST_TIMEOUT
  );

  it("displays loading state while fetching data", () => {
    vi.mocked(customersApi.getSite).mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof customersApi.getSite>>>(() => {})
    );
    vi.mocked(customersApi.listCustomers).mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof customersApi.listCustomers>>>(
          () => {}
        )
    );
    renderWithRouter();

    expect(
      screen.getByRole("heading", { name: /edit site/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading site form" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Loading\.\.\.$/i)).not.toBeInTheDocument();
  });

  it("displays error when site loading fails", async () => {
    vi.mocked(customersApi.getSite).mockRejectedValue(
      new Error("site not found")
    );

    renderWithRouter();

    const loadError = await screen.findByText(/site not found/i);
    expect(loadError).toBeInTheDocument();
    expect(loadError.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
  });

  it("keeps load and submit errors on canonical theme tokens", async () => {
    vi.mocked(customersApi.getSite).mockRejectedValueOnce(
      new Error("site not found")
    );

    renderWithRouter();

    const loadError = await screen.findByText(/site not found/i);
    expect(loadError.closest('[data-slot="alert"]')).toHaveClass(
      "text-foreground"
    );
  });

  it(
    "displays validation errors from API",
    async () => {
      const validationError = new Error("Validation failed") as Error & {
        errors?: Record<string, string[]>;
      };
      validationError.errors = {
        customer_id: ["The customer field is required."],
        name: ["The name must not exceed 255 characters."],
        "address.street": ["The street field must be a valid address."],
        "address.postal_code": ["The postal code field is required."],
        "contact.email": ["The contact email field must be a valid email."],
      };
      vi.mocked(customersApi.updateSite).mockRejectedValue(validationError);

      renderWithRouter();

      await waitFor(() => {
        expect(screen.getByLabelText(/site name/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

      await waitFor(() => {
        expect(customersApi.updateSite).toHaveBeenCalled();
        expect(
          screen.getByRole("combobox", { name: /customer/i })
        ).toHaveAttribute("aria-describedby", "site-customer-error");
        expect(screen.getByLabelText(/site name/i)).toHaveAttribute(
          "aria-describedby",
          "site-name-error"
        );
        expect(screen.getByLabelText(/street/i)).toHaveAttribute(
          "aria-describedby",
          "site-street-error"
        );
        expect(screen.getByLabelText(/postal code/i)).toHaveAttribute(
          "aria-describedby",
          "site-postal-code-error"
        );
        expect(screen.getByLabelText(/email/i)).toHaveAttribute(
          "aria-describedby",
          "site-contact-email-error"
        );
      });

      expect(
        screen.getByText(/please correct the errors below/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/the contact email field must be a valid email/i)
      ).toBeInTheDocument();
    },
    SLOW_TEST_TIMEOUT
  );

  it("shows cancel button that navigates back", async () => {
    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /cancel/i })).toBeInTheDocument();
    });

    const cancelButton = screen.getByRole("link", { name: /cancel/i });
    expect(cancelButton).toHaveAttribute("href", "/sites/site-123");
  });

  it("handles optional contact fields", async () => {
    const siteWithoutContact = { ...mockSite, contact: undefined };
    vi.mocked(customersApi.getSite).mockResolvedValue(siteWithoutContact);
    vi.mocked(customersApi.updateSite).mockResolvedValue(mockUpdatedSite);

    renderWithRouter();

    await screen.findByLabelText(/site name/i);

    // Add contact info
    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "jane@secpal.dev" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(customersApi.updateSite).toHaveBeenCalledWith(
        "site-123",
        expect.objectContaining({
          contact: expect.objectContaining({
            name: "Jane Doe",
            email: "jane@secpal.dev",
          }),
        })
      );
    });
  });

  it("omits contact from the update payload when no contact was loaded or edited", async () => {
    const siteWithoutContact = { ...mockSite, contact: undefined };
    vi.mocked(customersApi.getSite).mockResolvedValue(siteWithoutContact);
    vi.mocked(customersApi.updateSite).mockResolvedValue(mockUpdatedSite);

    renderWithRouter();

    await screen.findByLabelText(/site name/i);

    fireEvent.change(screen.getByLabelText(/site name/i), {
      target: { value: "Updated site name" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(customersApi.updateSite).toHaveBeenCalledWith("site-123", {
        customer_id: "customer-1",
        name: "Updated site name",
        address: {
          street: "Old Street 1",
          city: "Old City",
          postal_code: "11111",
          country: "DE",
        },
      });
    });
  });

  it("updates existing optional contact fields", async () => {
    vi.mocked(customersApi.updateSite).mockResolvedValue(mockUpdatedSite);

    renderWithRouter();

    await screen.findByLabelText(/site name/i);

    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "Jane Updated" },
    });
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: "+49 987 654321" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(customersApi.updateSite).toHaveBeenCalledWith(
        "site-123",
        expect.objectContaining({
          contact: {
            name: "Jane Updated",
            email: "john@secpal.dev",
            phone: "+49 987 654321",
          },
        })
      );
    });
  });

  it("removes optional contact fields when all contact inputs are cleared", async () => {
    vi.mocked(customersApi.updateSite).mockResolvedValue({
      ...mockUpdatedSite,
      contact: null,
    });

    renderWithRouter();

    await screen.findByLabelText(/site name/i);

    fireEvent.change(screen.getByLabelText(/^name$/i), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText(/phone/i), {
      target: { value: "" },
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(customersApi.updateSite).toHaveBeenCalledWith(
        "site-123",
        expect.objectContaining({
          contact: null,
        })
      );
    });
  });

  it("ignores a late-resolving fetch for the previous site after navigating between /sites/:id/edit routes", async () => {
    // `renderWithRouter` hard-codes `/sites/site-123/edit` as the initial
    // URL, so treat `site-123` as Site A and navigate to a fresh
    // `site-B`. The default `customersApi.getSite` mock from
    // `beforeEach` would resolve `site-123` immediately, so override it
    // here to keep that initial fetch pending.
    const siteA = {
      ...mockSite,
      id: "site-123",
      name: "Site A",
      site_number: "SITE-A",
    };
    const siteB = {
      ...mockSite,
      id: "site-B",
      name: "Site B",
      site_number: "SITE-B",
    };

    let resolveSiteA:
      | ((site: Awaited<ReturnType<typeof customersApi.getSite>>) => void)
      | undefined;
    vi.mocked(customersApi.getSite).mockImplementation(async (id) => {
      if (id === "site-123") {
        return new Promise((resolve) => {
          resolveSiteA = resolve;
        });
      }
      return siteB;
    });

    renderWithRouter();

    await act(async () => {
      window.history.pushState({}, "", "/sites/site-B/edit");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/site name/i)).toHaveValue("Site B");
    });

    // Late A resolution must NOT refill the form with Site A's data.
    await act(async () => {
      resolveSiteA?.(siteA);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByLabelText(/site name/i)).toHaveValue("Site B");
    expect(screen.queryByDisplayValue("Site A")).not.toBeInTheDocument();
  });

  it("clears the previous site's form when navigating between /sites/:id/edit routes", async () => {
    // `renderWithRouter` hard-codes `/sites/site-123/edit` as the initial
    // URL, so treat `site-123` as Site A here and navigate to a fresh
    // `site-B` to exercise the param-only route reuse path.
    const siteA = {
      ...mockSite,
      id: "site-123",
      name: "Site A",
      site_number: "SITE-A",
    };
    const siteB = {
      ...mockSite,
      id: "site-B",
      name: "Site B",
      site_number: "SITE-B",
    };

    let resolveSiteB:
      | ((site: Awaited<ReturnType<typeof customersApi.getSite>>) => void)
      | undefined;
    vi.mocked(customersApi.getSite).mockImplementation(async (id) => {
      if (id === "site-123") {
        return siteA;
      }
      return new Promise((resolve) => {
        resolveSiteB = resolve;
      });
    });

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/site name/i)).toHaveValue("Site A");
    });

    // Param-only navigation: same route pattern, different `:id`. React
    // Router reuses the same `SiteEdit` instance, so without the
    // in-effect reset the previous site's form would stay visible and
    // submittable under the new URL until the new fetch resolved.
    await act(async () => {
      window.history.pushState({}, "", "/sites/site-B/edit");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(
        screen.getByRole("status", { name: /loading site form/i })
      ).toBeInTheDocument();
    });
    expect(screen.queryByDisplayValue("Site A")).not.toBeInTheDocument();

    await act(async () => {
      resolveSiteB?.(siteB);
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/site name/i)).toHaveValue("Site B");
    });
  });

  it("preserves batched nested updates when saving", async () => {
    vi.mocked(customersApi.updateSite).mockResolvedValue(mockUpdatedSite);

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByLabelText(/site name/i)).toBeInTheDocument();
    });

    act(() => {
      fireEvent.change(screen.getByLabelText(/street/i), {
        target: { value: "Concurrent Street 99" },
      });
      fireEvent.change(screen.getByLabelText(/city/i), {
        target: { value: "Concurrent City" },
      });
    });

    fireEvent.click(screen.getByRole("button", { name: /save changes/i }));

    await waitFor(() => {
      expect(customersApi.updateSite).toHaveBeenCalledWith(
        "site-123",
        expect.objectContaining({
          address: expect.objectContaining({
            street: "Concurrent Street 99",
            city: "Concurrent City",
            postal_code: "11111",
          }),
        })
      );
    });
  });
});
