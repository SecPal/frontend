// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { CustomerTree } from "./CustomerTree";
import type { Customer, PaginatedResponse } from "../types/organizational";

// Mock the API module
vi.mock("../services/customerApi", () => ({
  listCustomers: vi.fn(),
  deleteCustomer: vi.fn(),
}));

import { listCustomers } from "../services/customerApi";

function renderWithI18n(component: React.ReactElement) {
  i18n.load("en", {});
  i18n.activate("en");
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

describe("CustomerTree", () => {
  const mockCustomers: Customer[] = [
    {
      id: "cust-1",
      customer_number: "CUST-001",
      type: "corporate",
      name: "Global Corp",
      objects: [
        {
          id: "obj-1",
          object_number: "OBJ-001",
          name: "Object 1",
          created_at: "",
          updated_at: "",
        },
        {
          id: "obj-2",
          object_number: "OBJ-002",
          name: "Object 2",
          created_at: "",
          updated_at: "",
        },
        {
          id: "obj-3",
          object_number: "OBJ-003",
          name: "Object 3",
          created_at: "",
          updated_at: "",
        },
        {
          id: "obj-4",
          object_number: "OBJ-004",
          name: "Object 4",
          created_at: "",
          updated_at: "",
        },
        {
          id: "obj-5",
          object_number: "OBJ-005",
          name: "Object 5",
          created_at: "",
          updated_at: "",
        },
      ],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "cust-2",
      customer_number: "CUST-002",
      type: "regional",
      name: "North Region Customer",
      parent: {
        id: "cust-1",
        customer_number: "CUST-001",
        type: "corporate",
        name: "Global Corp",
        created_at: "",
        updated_at: "",
      },
      objects: [
        {
          id: "obj-6",
          object_number: "OBJ-006",
          name: "Object 6",
          created_at: "",
          updated_at: "",
        },
        {
          id: "obj-7",
          object_number: "OBJ-007",
          name: "Object 7",
          created_at: "",
          updated_at: "",
        },
      ],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "cust-3",
      customer_number: "CUST-003",
      type: "local",
      name: "Local Branch",
      objects: [],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  const mockResponse: PaginatedResponse<Customer> = {
    data: mockCustomers,
    meta: { current_page: 1, last_page: 1, per_page: 100, total: 3 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listCustomers).mockResolvedValue(mockResponse);
  });

  it("renders loading state initially", () => {
    renderWithI18n(<CustomerTree />);
    expect(document.querySelector(".animate-pulse")).toBeInTheDocument();
  });

  it("renders customers after loading", async () => {
    renderWithI18n(<CustomerTree />);

    await waitFor(() => {
      expect(screen.getByText("Global Corp")).toBeInTheDocument();
    });

    expect(screen.getByText("Local Branch")).toBeInTheDocument();
  });

  it("renders empty state when no customers", async () => {
    vi.mocked(listCustomers).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 },
    });

    renderWithI18n(<CustomerTree />);

    await waitFor(() => {
      expect(screen.getByText("No Customers")).toBeInTheDocument();
    });
  });

  it("shows error state on API failure", async () => {
    vi.mocked(listCustomers).mockRejectedValue(new Error("Network error"));

    renderWithI18n(<CustomerTree />);

    await waitFor(() => {
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });
  });

  it("calls onSelect when customer is clicked", async () => {
    const onSelect = vi.fn();
    renderWithI18n(<CustomerTree onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Global Corp")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Global Corp"));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "cust-1",
        name: "Global Corp",
      })
    );
  });

  it("shows create button when onCreate is provided", async () => {
    const onCreate = vi.fn();
    renderWithI18n(<CustomerTree onCreate={onCreate} />);

    await waitFor(() => {
      expect(screen.getByText("Add Customer")).toBeInTheDocument();
    });
  });

  it("shows create button in empty state", async () => {
    vi.mocked(listCustomers).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 },
    });

    const onCreate = vi.fn();
    renderWithI18n(<CustomerTree onCreate={onCreate} />);

    await waitFor(() => {
      expect(screen.getByText("Add Customer")).toBeInTheDocument();
    });
  });

  it("displays object count for customers", async () => {
    renderWithI18n(<CustomerTree />);

    await waitFor(() => {
      expect(screen.getByText("Global Corp")).toBeInTheDocument();
    });

    // Object counts should be displayed as "{count} objects"
    expect(screen.getByText(/5\s+objects/)).toBeInTheDocument();
    expect(screen.getByText(/2\s+objects/)).toBeInTheDocument();
  });

  it("filters customers by type when typeFilter is provided", async () => {
    renderWithI18n(<CustomerTree typeFilter="corporate" />);

    await waitFor(() => {
      expect(listCustomers).toHaveBeenCalledWith(
        expect.objectContaining({ type: "corporate" })
      );
    });
  });

  it("builds tree structure from flat list", async () => {
    renderWithI18n(<CustomerTree />);

    await waitFor(() => {
      expect(screen.getByText("Global Corp")).toBeInTheDocument();
    });

    const northCustomer = screen.getByText("North Region Customer");
    expect(northCustomer).toBeInTheDocument();
  });

  it("shows flat view when flatView prop is true", async () => {
    renderWithI18n(<CustomerTree flatView />);

    await waitFor(() => {
      expect(screen.getByText("Global Corp")).toBeInTheDocument();
      expect(screen.getByText("North Region Customer")).toBeInTheDocument();
    });
  });

  it("has accessible tree structure", async () => {
    renderWithI18n(<CustomerTree />);

    await waitFor(() => {
      expect(screen.getByRole("tree")).toBeInTheDocument();
    });

    const treeItems = screen.getAllByRole("treeitem");
    expect(treeItems.length).toBeGreaterThan(0);
  });
});
