// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import SiteDetail from "./SiteDetail";
import * as customersApi from "../../services/customersApi";
import * as organizationalUnitApi from "../../services/organizationalUnitApi";

const { mockUseUserCapabilities } = vi.hoisted(() => ({
  mockUseUserCapabilities: vi.fn(),
}));

vi.mock("../../services/customersApi");
vi.mock("../../services/organizationalUnitApi");
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

function renderWithRouter() {
  return render(
    <BrowserRouter>
      <I18nProvider i18n={i18n}>
        <Routes>
          <Route path="/sites/:id" element={<SiteDetail />} />
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

describe("SiteDetail", () => {
  const mockSite = {
    id: "site-123",
    site_number: "SITE-2025-001",
    name: "Munich Office",
    type: "permanent" as const,
    customer_id: "customer-123",
    organizational_unit_id: "org-unit-123",
    address: {
      street: "Teststrasse 42",
      city: "München",
      postal_code: "80331",
      country: "DE",
    },
    full_address: "Teststrasse 42, 80331 München, DE",
    contact: {
      name: "Max Mustermann",
      email: "max@test.de",
      phone: "+49 89 123456",
    },
    is_active: true,
    is_expired: false,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-20T15:30:00Z",
  };

  const mockCustomer = {
    id: "customer-123",
    name: "Test Customer GmbH",
    customer_number: "CUST-2025-001",
    billing_address: {
      street: "Street",
      city: "City",
      postal_code: "12345",
      country: "DE",
    },
    is_active: true,
    sites_count: 1,
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-20T15:30:00Z",
  };

  const mockOrgUnit = {
    id: "org-unit-123",
    type: "department" as const,
    name: "IT Department",
    created_at: "2025-01-15T10:00:00Z",
    updated_at: "2025-01-20T15:30:00Z",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "", "/sites/site-123");
    mockUseUserCapabilities.mockReturnValue({
      actions: {
        sites: { create: true, update: true, delete: true },
      },
    });
  });

  it("loads and displays site details with customer and org unit names", async () => {
    vi.mocked(customersApi.getSite).mockResolvedValue(mockSite);
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );

    renderWithRouter();

    await waitFor(() => {
      expect(customersApi.getSite).toHaveBeenCalledWith("site-123");
    });

    // Check site details
    expect(screen.getByText("Munich Office")).toBeInTheDocument();
    expect(screen.getByText("SITE-2025-001")).toBeInTheDocument();

    // Check customer name is displayed (not ID or "View Customer")
    await waitFor(() => {
      expect(screen.getByText("Test Customer GmbH")).toBeInTheDocument();
    });
    expect(
      screen.getByRole("link", { name: "Test Customer GmbH" })
    ).toHaveAttribute("href", "/customers/customer-123");
    expect(screen.getByText("CUST-2025-001")).toBeInTheDocument();
    expect(screen.getByText("Street, 12345 City, DE")).toBeInTheDocument();

    // Check org unit name is displayed (not ID)
    expect(screen.getByText("IT Department")).toBeInTheDocument();

    // Check address
    expect(screen.getByText("Teststrasse 42")).toBeInTheDocument();
    expect(screen.getByText("80331")).toBeInTheDocument();
    expect(screen.getByText("München")).toBeInTheDocument();
  });

  it("renders postal code and city on separate site-address lines", async () => {
    vi.mocked(customersApi.getSite).mockResolvedValue(mockSite);
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Munich Office")).toBeInTheDocument();
    });

    expect(screen.getByText("Postal Code")).toBeInTheDocument();
    expect(screen.getByText("City")).toBeInTheDocument();
    expect(screen.getByText("80331")).toBeInTheDocument();
    expect(screen.getByText("München")).toBeInTheDocument();
    expect(screen.queryByText("80331 München")).not.toBeInTheDocument();
  });

  it("keeps the detail frame visible while site data loads", () => {
    vi.mocked(customersApi.getSite).mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof customersApi.getSite>>>(() => {})
    );

    renderWithRouter();

    expect(screen.getByRole("heading", { name: "Site" })).toBeInTheDocument();
    // Only the first section skeleton announces; the other two are
    // decorative so assistive tech does not stack identical "Loading
    // site details" live regions at the same time.
    expect(
      screen.getAllByRole("status", { name: "Loading site details" })
    ).toHaveLength(1);
    expect(screen.getByRole("link", { name: /back to list/i })).toHaveAttribute(
      "href",
      "/sites"
    );
    expect(screen.queryByText(/^Loading\.\.\.$/i)).not.toBeInTheDocument();
  });

  it("renders site details while customer and org unit lookup data loads", async () => {
    vi.mocked(customersApi.getSite).mockResolvedValue(mockSite);
    vi.mocked(customersApi.getCustomer).mockImplementation(
      () =>
        new Promise<Awaited<ReturnType<typeof customersApi.getCustomer>>>(
          () => {}
        )
    );
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockImplementation(
      () =>
        new Promise<
          Awaited<
            ReturnType<typeof organizationalUnitApi.getOrganizationalUnit>
          >
        >(() => {})
    );

    renderWithRouter();

    expect(await screen.findByText("Munich Office")).toBeInTheDocument();
    expect(screen.getByText("SITE-2025-001")).toBeInTheDocument();
    expect(
      screen.getByRole("status", { name: "Loading site lookup data" })
    ).toBeInTheDocument();
    expect(screen.queryByText(/^Loading\.\.\.$/i)).not.toBeInTheDocument();
  });

  it("uses the customer relation from the site response for customer navigation", async () => {
    vi.mocked(customersApi.getSite).mockResolvedValue({
      ...mockSite,
      customer: mockCustomer,
    });
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );

    renderWithRouter();

    const customerLink = await screen.findByRole("link", {
      name: "Test Customer GmbH",
    });

    expect(customerLink).toHaveAttribute("href", "/customers/customer-123");
    expect(screen.getByText("CUST-2025-001")).toBeInTheDocument();
    expect(customersApi.getCustomer).not.toHaveBeenCalled();
  });

  it("displays badges for site type and status", async () => {
    vi.mocked(customersApi.getSite).mockResolvedValue(mockSite);
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Permanent")).toBeInTheDocument();
    });

    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows expired badge when site is expired", async () => {
    const expiredSite = { ...mockSite, is_expired: true };
    vi.mocked(customersApi.getSite).mockResolvedValue(expiredSite);
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Expired")).toBeInTheDocument();
    });
  });

  it("keeps detail heading secondary text and destructive states on canonical theme tokens", async () => {
    vi.mocked(customersApi.getSite).mockResolvedValue(mockSite);
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );

    renderWithRouter();

    const siteNumber = await screen.findByText("SITE-2025-001");
    expect(siteNumber).toHaveClass("text-muted-foreground");
  });

  it("keeps delete-site errors on canonical destructive tokens", async () => {
    vi.mocked(customersApi.getSite).mockResolvedValue(mockSite);
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );
    vi.mocked(customersApi.deleteSite).mockRejectedValueOnce(
      new Error("Delete failed")
    );

    renderWithRouter();

    const user = userEvent.setup();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /delete/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /delete/i }));
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    const deleteError = await screen.findByText("Delete failed");
    expect(deleteError).toHaveAttribute("data-slot", "alert-description");
    expect(deleteError.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
  });

  it("displays contact information", async () => {
    vi.mocked(customersApi.getSite).mockResolvedValue(mockSite);
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Max Mustermann")).toBeInTheDocument();
    });

    expect(screen.getByText("max@test.de")).toBeInTheDocument();
    expect(screen.getByText("+49 89 123456")).toBeInTheDocument();
    expect(screen.getByText("max@test.de").closest("a")).toHaveAttribute(
      "href",
      "mailto:max@test.de"
    );
    expect(screen.getByText("+49 89 123456").closest("a")).toHaveAttribute(
      "href",
      "tel:+49 89 123456"
    );
  });

  it("renders unsafe contact email and phone as plain text", async () => {
    const unsafeSite = {
      ...mockSite,
      contact: {
        ...mockSite.contact,
        email: "target@example.com?bcc=attacker@evil.com&subject=PWN",
        phone: "+49?suffix=evil",
      },
    };
    vi.mocked(customersApi.getSite).mockResolvedValue(unsafeSite);
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );

    const { container } = renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(unsafeSite.contact.email)).toBeInTheDocument();
    });

    expect(screen.getByText(unsafeSite.contact.email).closest("a")).toBeNull();
    expect(screen.getByText(unsafeSite.contact.phone).closest("a")).toBeNull();
    expectNoUnsafeContactHrefs(container);
  });

  it("shows edit and delete buttons", async () => {
    vi.mocked(customersApi.getSite).mockResolvedValue(mockSite);
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /edit/i })).toBeInTheDocument();
    });

    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("opens delete confirmation dialog", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getSite).mockResolvedValue(mockSite);
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );

    renderWithRouter();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /delete/i })
      ).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: /delete/i }));

    expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
  });

  it("deletes site and navigates to list", async () => {
    const user = userEvent.setup();
    vi.mocked(customersApi.getSite).mockResolvedValue(mockSite);
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );
    vi.mocked(customersApi.deleteSite).mockResolvedValue(undefined);

    renderWithRouter();

    await waitFor(() => {
      expect(
        screen.getByRole("button", { name: /delete/i })
      ).toBeInTheDocument();
    });

    // Open dialog
    await user.click(screen.getByRole("button", { name: /^delete$/i }));

    // Wait for dialog and confirm deletion
    await waitFor(() => {
      expect(screen.getByText(/are you sure/i)).toBeInTheDocument();
    });

    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    const confirmButton = deleteButtons.find(
      (btn) => btn.textContent === "Delete" && !btn.hasAttribute("disabled")
    );
    expect(confirmButton).toBeDefined();
    await user.click(confirmButton!);

    await waitFor(() => {
      expect(customersApi.deleteSite).toHaveBeenCalledWith("site-123");
      expect(mockNavigate).toHaveBeenCalledWith("/sites");
    });
  });

  it("displays error when site loading fails", async () => {
    vi.mocked(customersApi.getSite).mockRejectedValue(
      new Error("failed to load site")
    );

    renderWithRouter();

    const loadError = await screen.findByText(/failed to load site/i);
    expect(loadError).toBeInTheDocument();
    expect(loadError.closest('[data-slot="alert"]')).toHaveClass(
      "border-destructive/30",
      "bg-destructive/10"
    );
  });

  it("falls back to IDs when customer or org unit loading fails", async () => {
    vi.mocked(customersApi.getSite).mockResolvedValue(mockSite);
    vi.mocked(customersApi.getCustomer).mockRejectedValue(
      new Error("Failed to load customer")
    );
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockRejectedValue(
      new Error("Failed to load org unit")
    );

    renderWithRouter();

    await waitFor(() => {
      // site name should still be displayed
      expect(screen.getByText("Munich Office")).toBeInTheDocument();
    });

    // Should display IDs as fallback
    expect(screen.getByText("customer-123")).toBeInTheDocument();
    expect(screen.getByText("org-unit-123")).toBeInTheDocument();
  });

  it("hides edit and delete actions without site management capabilities", async () => {
    mockUseUserCapabilities.mockReturnValue({
      actions: {
        sites: { create: false, update: false, delete: false },
      },
    });
    vi.mocked(customersApi.getSite).mockResolvedValue(mockSite);
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText("Munich Office")).toBeInTheDocument();
    });

    expect(
      screen.queryByRole("link", { name: /edit/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^delete$/i })
    ).not.toBeInTheDocument();
  });

  it("ignores a late-resolving fetch for the previous site after navigating between /sites/:id routes", async () => {
    const siteA = {
      ...mockSite,
      id: "site-A",
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
      if (id === "site-A") {
        return new Promise((resolve) => {
          resolveSiteA = resolve;
        });
      }
      return siteB;
    });
    vi.mocked(customersApi.getCustomer).mockResolvedValue(mockCustomer);
    vi.mocked(organizationalUnitApi.getOrganizationalUnit).mockResolvedValue(
      mockOrgUnit
    );

    window.history.pushState({}, "", "/sites/site-A");
    renderWithRouter();

    await act(async () => {
      window.history.pushState({}, "", "/sites/site-B");
      window.dispatchEvent(new PopStateEvent("popstate"));
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByText("Site B")).toBeInTheDocument();
    });

    // Late A resolution must not clobber the rendered B record.
    await act(async () => {
      resolveSiteA?.(siteA);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText("Site B")).toBeInTheDocument();
    expect(screen.queryByText("Site A")).not.toBeInTheDocument();
    expect(screen.queryByText("SITE-A")).not.toBeInTheDocument();
  });
});
