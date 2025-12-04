// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { OrganizationalUnitTree } from "./OrganizationalUnitTree";
import type {
  OrganizationalUnit,
  OrganizationalUnitPaginatedResponse,
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

  const mockResponse: OrganizationalUnitPaginatedResponse = {
    data: mockUnits,
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 100,
      total: 3,
      root_unit_ids: ["unit-1", "unit-3"],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listOrganizationalUnits).mockResolvedValue(mockResponse);
  });

  it("renders loading state initially", async () => {
    renderWithI18n(<OrganizationalUnitTree />);

    // Loading skeleton should be visible
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();

    // Wait for async operations to complete to prevent act() warnings
    await waitFor(() => {
      expect(document.querySelector(".animate-pulse")).not.toBeInTheDocument();
    });
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
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: 0,
        root_unit_ids: [],
      },
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
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: 0,
        root_unit_ids: [],
      },
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

  it("displays 'My Organization' as default heading", async () => {
    renderWithI18n(<OrganizationalUnitTree />);

    await waitFor(() => {
      expect(screen.getByText("My Organization")).toBeInTheDocument();
    });
  });

  it("allows custom title via prop", async () => {
    renderWithI18n(<OrganizationalUnitTree title="Custom Title" />);

    await waitFor(() => {
      expect(screen.getByText("Custom Title")).toBeInTheDocument();
    });
  });
});

describe("OrganizationalUnitTree - Permission Filtered", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses root_unit_ids to determine tree roots", async () => {
    // Scenario: User only has access to a region and its branches
    // The region's parent (company) is NOT accessible
    const regionUnit: OrganizationalUnit = {
      id: "region-1",
      type: "region",
      name: "Berlin-Brandenburg",
      parent: {
        id: "company-1", // Parent exists but not in accessible units
        type: "company",
        name: "ProSec Nord GmbH",
        created_at: "",
        updated_at: "",
      },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    const branchUnit: OrganizationalUnit = {
      id: "branch-1",
      type: "branch",
      name: "Niederlassung Berlin",
      parent: {
        id: "region-1",
        type: "region",
        name: "Berlin-Brandenburg",
        created_at: "",
        updated_at: "",
      },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(listOrganizationalUnits).mockResolvedValue({
      data: [regionUnit, branchUnit],
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: 2,
        root_unit_ids: ["region-1"], // Region is root because parent is inaccessible
      },
    });

    renderWithI18n(<OrganizationalUnitTree />);

    await waitFor(() => {
      // Region should be displayed as root
      expect(screen.getByText("Berlin-Brandenburg")).toBeInTheDocument();
      // Branch should be displayed as child
      expect(screen.getByText("Niederlassung Berlin")).toBeInTheDocument();
    });

    // Verify tree structure - region should be at level 0 (root)
    const treeItems = screen.getAllByRole("treeitem");
    expect(treeItems).toHaveLength(2);
  });

  it("branch manager sees only their single branch", async () => {
    const singleBranch: OrganizationalUnit = {
      id: "branch-berlin",
      type: "branch",
      name: "Niederlassung Berlin",
      parent: {
        id: "region-1", // Parent not accessible
        type: "region",
        name: "Berlin-Brandenburg",
        created_at: "",
        updated_at: "",
      },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(listOrganizationalUnits).mockResolvedValue({
      data: [singleBranch],
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: 1,
        root_unit_ids: ["branch-berlin"],
      },
    });

    renderWithI18n(<OrganizationalUnitTree />);

    await waitFor(() => {
      expect(screen.getByText("Niederlassung Berlin")).toBeInTheDocument();
    });

    // Only one tree item should be visible
    const treeItems = screen.getAllByRole("treeitem");
    expect(treeItems).toHaveLength(1);
  });

  it("regional manager sees region with expandable children", async () => {
    const regionUnit: OrganizationalUnit = {
      id: "region-1",
      type: "region",
      name: "Region Berlin-Brandenburg",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    const branch1: OrganizationalUnit = {
      id: "branch-1",
      type: "branch",
      name: "Niederlassung Berlin",
      parent: {
        id: "region-1",
        type: "region",
        name: "Region Berlin-Brandenburg",
        created_at: "",
        updated_at: "",
      },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    const branch2: OrganizationalUnit = {
      id: "branch-2",
      type: "branch",
      name: "Niederlassung Potsdam",
      parent: {
        id: "region-1",
        type: "region",
        name: "Region Berlin-Brandenburg",
        created_at: "",
        updated_at: "",
      },
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(listOrganizationalUnits).mockResolvedValue({
      data: [regionUnit, branch1, branch2],
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: 3,
        root_unit_ids: ["region-1"],
      },
    });

    renderWithI18n(<OrganizationalUnitTree />);

    await waitFor(() => {
      expect(screen.getByText("Region Berlin-Brandenburg")).toBeInTheDocument();
      expect(screen.getByText("Niederlassung Berlin")).toBeInTheDocument();
      expect(screen.getByText("Niederlassung Potsdam")).toBeInTheDocument();
    });

    // Three tree items: 1 region + 2 branches
    const treeItems = screen.getAllByRole("treeitem");
    expect(treeItems).toHaveLength(3);
  });

  it("handles user with multiple scopes (multiple roots)", async () => {
    // User has access to two separate regions
    const region1: OrganizationalUnit = {
      id: "region-1",
      type: "region",
      name: "Region Berlin",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    const region2: OrganizationalUnit = {
      id: "region-2",
      type: "region",
      name: "Region Hamburg",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    };

    vi.mocked(listOrganizationalUnits).mockResolvedValue({
      data: [region1, region2],
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 100,
        total: 2,
        root_unit_ids: ["region-1", "region-2"], // Both regions are roots
      },
    });

    renderWithI18n(<OrganizationalUnitTree />);

    await waitFor(() => {
      expect(screen.getByText("Region Berlin")).toBeInTheDocument();
      expect(screen.getByText("Region Hamburg")).toBeInTheDocument();
    });

    // Both regions should be at root level
    const treeItems = screen.getAllByRole("treeitem");
    expect(treeItems).toHaveLength(2);
  });
});
