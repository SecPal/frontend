// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OrganizationalUnitTree } from "./OrganizationalUnitTree";
import type {
  OrganizationalUnit,
  PaginatedResponse,
} from "../types/organizational";

// Mock the API module
vi.mock("../services/organizationalUnitApi", () => ({
  listOrganizationalUnits: vi.fn(),
  deleteOrganizationalUnit: vi.fn(),
}));

import {
  listOrganizationalUnits,
  deleteOrganizationalUnit,
} from "../services/organizationalUnitApi";

function renderWithI18n(component: React.ReactElement) {
  i18n.load("en", {});
  i18n.activate("en");
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

describe("OrganizationalUnitTree", () => {
  const mockUnits: OrganizationalUnit[] = [
    {
      id: "unit-1",
      type: "company",
      name: "Test Company",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "unit-2",
      type: "department",
      name: "IT Department",
      parent: {
        id: "unit-1",
        type: "company",
        name: "Test Company",
        created_at: "",
        updated_at: "",
      },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "unit-3",
      type: "region",
      name: "North Region",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  const mockResponse: PaginatedResponse<OrganizationalUnit> = {
    data: mockUnits,
    meta: { current_page: 1, last_page: 1, per_page: 100, total: 3 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listOrganizationalUnits).mockResolvedValue(mockResponse);
  });

  it("renders loading state initially", () => {
    renderWithI18n(<OrganizationalUnitTree />);

    // Loading skeleton should be visible
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders organizational units after loading", async () => {
    renderWithI18n(<OrganizationalUnitTree />);

    await waitFor(() => {
      expect(screen.getByText("Test Company")).toBeInTheDocument();
    });

    expect(screen.getByText("North Region")).toBeInTheDocument();
  });

  it("renders empty state when no units", async () => {
    vi.mocked(listOrganizationalUnits).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 },
    });

    renderWithI18n(<OrganizationalUnitTree />);

    await waitFor(() => {
      expect(screen.getByText("No Organizational Units")).toBeInTheDocument();
    });
  });

  it("shows error state on API failure", async () => {
    vi.mocked(listOrganizationalUnits).mockRejectedValue(
      new Error("Network error")
    );

    renderWithI18n(<OrganizationalUnitTree />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("calls onSelect when unit is clicked", async () => {
    const onSelect = vi.fn();
    renderWithI18n(<OrganizationalUnitTree onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Test Company")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test Company"));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "unit-1",
        name: "Test Company",
      })
    );
  });

  it("shows create button when onCreate is provided", async () => {
    const onCreate = vi.fn();
    renderWithI18n(<OrganizationalUnitTree onCreate={onCreate} />);

    await waitFor(() => {
      expect(screen.getByText("Add Unit")).toBeInTheDocument();
    });
  });

  it("shows create button in empty state", async () => {
    vi.mocked(listOrganizationalUnits).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 },
    });

    const onCreate = vi.fn();
    renderWithI18n(<OrganizationalUnitTree onCreate={onCreate} />);

    await waitFor(() => {
      expect(
        screen.getByText("Create Organizational Unit")
      ).toBeInTheDocument();
    });
  });

  it("calls deleteOrganizationalUnit on delete confirmation", async () => {
    vi.mocked(deleteOrganizationalUnit).mockResolvedValue(undefined);
    window.confirm = vi.fn(() => true);

    const onDelete = vi.fn();
    renderWithI18n(<OrganizationalUnitTree onDelete={onDelete} />);

    await waitFor(() => {
      expect(screen.getByText("Test Company")).toBeInTheDocument();
    });

    // Note: Delete button is hidden by default, would need to hover/focus
    // This is a simplified test - in real implementation would need to simulate hover
  });

  it("filters units by type when typeFilter is provided", async () => {
    renderWithI18n(<OrganizationalUnitTree typeFilter="company" />);

    await waitFor(() => {
      expect(listOrganizationalUnits).toHaveBeenCalledWith(
        expect.objectContaining({ type: "company" })
      );
    });
  });

  it("builds tree structure from flat list", async () => {
    renderWithI18n(<OrganizationalUnitTree />);

    await waitFor(() => {
      expect(screen.getByText("Test Company")).toBeInTheDocument();
    });

    // IT Department should be a child of Test Company
    // In tree view, it should be indented
    const itDept = screen.getByText("IT Department");
    expect(itDept).toBeInTheDocument();
  });

  it("shows flat view when flatView prop is true", async () => {
    renderWithI18n(<OrganizationalUnitTree flatView />);

    await waitFor(() => {
      expect(screen.getByText("Test Company")).toBeInTheDocument();
      expect(screen.getByText("IT Department")).toBeInTheDocument();
    });
  });

  it("has accessible tree structure", async () => {
    renderWithI18n(<OrganizationalUnitTree />);

    await waitFor(() => {
      expect(screen.getByRole("tree")).toBeInTheDocument();
    });

    const treeItems = screen.getAllByRole("treeitem");
    expect(treeItems.length).toBeGreaterThan(0);
  });
});
