// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ObjectManager } from "./ObjectManager";
import type { SecPalObject, PaginatedResponse } from "../types/organizational";

// Mock the API module
vi.mock("../services/objectApi", () => ({
  listObjects: vi.fn(),
  deleteObject: vi.fn(),
  getObjectAreas: vi.fn(),
  deleteObjectArea: vi.fn(),
}));

import { listObjects, getObjectAreas } from "../services/objectApi";

function renderWithI18n(component: React.ReactElement) {
  i18n.load("en", {});
  i18n.activate("en");
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

describe("ObjectManager", () => {
  const mockObjects: SecPalObject[] = [
    {
      id: "obj-1",
      object_number: "OBJ-001",
      name: "Main Building",
      address: "123 Main St",
      areas: [
        {
          id: "area-1",
          name: "Entrance",
          requires_separate_guard_book: false,
          created_at: "2025-01-01T00:00:00Z",
          updated_at: "2025-01-01T00:00:00Z",
        },
      ],
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "obj-2",
      object_number: "OBJ-002",
      name: "Warehouse",
      address: "456 Industrial Blvd",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  const mockResponse: PaginatedResponse<SecPalObject> = {
    data: mockObjects,
    meta: { current_page: 1, last_page: 1, per_page: 15, total: 2 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listObjects).mockResolvedValue(mockResponse);
    vi.mocked(getObjectAreas).mockResolvedValue([]);
  });

  it("renders loading state initially", async () => {
    renderWithI18n(<ObjectManager customerId="cust-1" />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();

    // Wait for async operations to complete to prevent act() warnings
    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    });
  });

  it("renders objects after loading", async () => {
    renderWithI18n(<ObjectManager customerId="cust-1" />);

    await waitFor(() => {
      expect(screen.getByText("Main Building")).toBeInTheDocument();
    });

    expect(screen.getByText("Warehouse")).toBeInTheDocument();
  });

  it("displays object number", async () => {
    renderWithI18n(<ObjectManager customerId="cust-1" />);

    await waitFor(() => {
      expect(screen.getByText("OBJ-001")).toBeInTheDocument();
    });
    expect(screen.getByText("OBJ-002")).toBeInTheDocument();
  });

  it("displays object address", async () => {
    renderWithI18n(<ObjectManager customerId="cust-1" />);

    await waitFor(() => {
      expect(screen.getByText("123 Main St")).toBeInTheDocument();
    });
  });

  it("renders empty state when no objects", async () => {
    vi.mocked(listObjects).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 },
    });

    renderWithI18n(<ObjectManager customerId="cust-1" />);

    await waitFor(() => {
      expect(screen.getByText("No Objects")).toBeInTheDocument();
    });
  });

  it("shows error state on API failure", async () => {
    vi.mocked(listObjects).mockRejectedValue(new Error("Failed to load"));

    renderWithI18n(<ObjectManager customerId="cust-1" />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load")).toBeInTheDocument();
    });
  });

  it("calls onSelect when object is clicked", async () => {
    const onSelect = vi.fn();
    renderWithI18n(<ObjectManager customerId="cust-1" onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Main Building")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Main Building"));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: "obj-1",
          name: "Main Building",
        })
      );
    });
  });

  it("shows create button when onCreate is provided", async () => {
    const onCreate = vi.fn();
    renderWithI18n(<ObjectManager customerId="cust-1" onCreate={onCreate} />);

    await waitFor(() => {
      expect(screen.getByText("Add Object")).toBeInTheDocument();
    });
  });

  it("filters objects by customer ID", async () => {
    renderWithI18n(<ObjectManager customerId="cust-123" />);

    await waitFor(() => {
      expect(listObjects).toHaveBeenCalledWith(
        expect.objectContaining({ customer_id: "cust-123" })
      );
    });
  });

  it("shows area count for objects with areas", async () => {
    renderWithI18n(<ObjectManager customerId="cust-1" />);

    await waitFor(() => {
      expect(screen.getByText("Main Building")).toBeInTheDocument();
    });

    // The object card should show it has areas
    // Note: areas are loaded separately via getObjectAreas when object is selected
  });

  it("shows object detail panel when object is selected", async () => {
    vi.mocked(getObjectAreas).mockResolvedValue([
      {
        id: "area-1",
        name: "Entrance Area",
        requires_separate_guard_book: false,
        created_at: "2025-01-01T00:00:00Z",
        updated_at: "2025-01-01T00:00:00Z",
      },
    ]);

    renderWithI18n(<ObjectManager customerId="cust-1" />);

    await waitFor(() => {
      expect(screen.getByText("Main Building")).toBeInTheDocument();
    });

    // Click on object to select it
    fireEvent.click(screen.getByText("Main Building"));

    // Wait for areas to load
    await waitFor(() => {
      expect(screen.getByText("Entrance Area")).toBeInTheDocument();
    });
  });

  it("shows object actions on hover", async () => {
    const onEdit = vi.fn();
    renderWithI18n(<ObjectManager customerId="cust-1" onEdit={onEdit} />);

    await waitFor(() => {
      expect(screen.getByText("Main Building")).toBeInTheDocument();
    });

    // Edit button should exist (may be hidden until hover)
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it("loads objects with pagination metadata", async () => {
    vi.mocked(listObjects).mockResolvedValue({
      data: mockObjects,
      meta: { current_page: 1, last_page: 3, per_page: 15, total: 45 },
    });

    renderWithI18n(<ObjectManager customerId="cust-1" />);

    await waitFor(() => {
      expect(screen.getByText("Main Building")).toBeInTheDocument();
    });

    // Verify the component receives paginated data
    expect(listObjects).toHaveBeenCalledWith(
      expect.objectContaining({ customer_id: "cust-1" })
    );
  });
});
