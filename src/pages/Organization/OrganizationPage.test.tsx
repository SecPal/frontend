// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OrganizationPage } from "./OrganizationPage";
import * as organizationalUnitApi from "../../services/organizationalUnitApi";
import type { OrganizationalUnit } from "../../types";

// Mock the API
vi.mock("../../services/organizationalUnitApi", () => ({
  listOrganizationalUnits: vi.fn(),
}));

// Helper to render with providers
const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{component}</MemoryRouter>
    </I18nProvider>
  );
};

describe("OrganizationPage", () => {
  const mockUnits: OrganizationalUnit[] = [
    {
      id: "unit-1",
      type: "holding",
      name: "SecPal Holding",
      description: "Root organizational unit",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "unit-2",
      type: "company",
      name: "SecPal GmbH",
      description: "Main operating company",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(organizationalUnitApi.listOrganizationalUnits).mockResolvedValue({
      data: mockUnits,
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: 2,
        root_unit_ids: ["unit-1"],
      },
    });
  });

  it("renders page heading", async () => {
    renderWithProviders(<OrganizationPage />);

    expect(screen.getByText("Organization Structure")).toBeInTheDocument();

    // Wait for OrganizationalUnitTree to finish loading
    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });
  });

  it("renders page description", async () => {
    renderWithProviders(<OrganizationPage />);

    expect(
      screen.getByText(/Manage your internal organizational units/)
    ).toBeInTheDocument();

    // Wait for OrganizationalUnitTree to finish loading
    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });
  });

  it("shows placeholder when no unit is selected", async () => {
    renderWithProviders(<OrganizationPage />);

    await waitFor(() => {
      expect(
        screen.getByText("Select an organizational unit to view details")
      ).toBeInTheDocument();
    });
  });

  it("renders the OrganizationalUnitTree component", async () => {
    renderWithProviders(<OrganizationPage />);

    // Wait for tree to load
    await waitFor(() => {
      expect(
        organizationalUnitApi.listOrganizationalUnits
      ).toHaveBeenCalledWith({ per_page: 100 });
    });
  });

  it("displays unit details when a unit is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationPage />);

    // Wait for units to load
    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });

    // Click on a unit to select it
    await user.click(screen.getByText("SecPal Holding"));

    // Detail panel should show the unit info
    await waitFor(() => {
      // The heading in detail panel
      const headings = screen.getAllByText("SecPal Holding");
      expect(headings.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("shows Type field in detail panel when unit is selected", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationPage />);

    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });

    await user.click(screen.getByText("SecPal Holding"));

    await waitFor(() => {
      expect(screen.getByText("Type")).toBeInTheDocument();
      // "Holding" appears twice: once in tree badge (translated), once in detail panel
      expect(screen.getAllByText("Holding")).toHaveLength(2);
    });
  });

  it("shows Description in detail panel when unit has one", async () => {
    const user = userEvent.setup();
    renderWithProviders(<OrganizationPage />);

    await waitFor(() => {
      expect(screen.getByText("SecPal Holding")).toBeInTheDocument();
    });

    await user.click(screen.getByText("SecPal Holding"));

    await waitFor(() => {
      expect(screen.getByText("Description")).toBeInTheDocument();
      expect(screen.getByText("Root organizational unit")).toBeInTheDocument();
    });
  });
});
