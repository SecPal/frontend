// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import SiteDetail from "./SiteDetail";
import * as customersApi from "../../services/customersApi";
import * as organizationalUnitApi from "../../services/organizationalUnitApi";

vi.mock("../../services/customersApi");
vi.mock("../../services/organizationalUnitApi");

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

    // Check org unit name is displayed (not ID)
    expect(screen.getByText("IT Department")).toBeInTheDocument();

    // Check address
    expect(screen.getByText("Teststrasse 42")).toBeInTheDocument();
    expect(screen.getByText(/80331 München/)).toBeInTheDocument();
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
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
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
      expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
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
      new Error("Failed to load site")
    );

    renderWithRouter();

    await waitFor(() => {
      expect(screen.getByText(/failed to load site/i)).toBeInTheDocument();
    });
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
      // Site name should still be displayed
      expect(screen.getByText("Munich Office")).toBeInTheDocument();
    });

    // Should display IDs as fallback
    expect(screen.getByText("customer-123")).toBeInTheDocument();
    expect(screen.getByText("org-unit-123")).toBeInTheDocument();
  });
});
