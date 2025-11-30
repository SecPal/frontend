// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { GuardBooksPage } from "./GuardBooksPage";
import * as guardBookApi from "../../services/guardBookApi";
import type { GuardBook } from "../../types";

// Mock the API
vi.mock("../../services/guardBookApi", () => ({
  listGuardBooks: vi.fn(),
  getGuardBookReports: vi.fn(),
}));

// Helper to render with providers and route params
const renderWithRoute = (
  customerId: string,
  objectId: string,
  areaId?: string
) => {
  const path = areaId
    ? `/customers/${customerId}/objects/${objectId}/areas/${areaId}/guard-books`
    : `/customers/${customerId}/objects/${objectId}/guard-books`;

  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/customers/:customerId/objects/:objectId/guard-books"
            element={<GuardBooksPage />}
          />
          <Route
            path="/customers/:customerId/objects/:objectId/areas/:areaId/guard-books"
            element={<GuardBooksPage />}
          />
        </Routes>
      </MemoryRouter>
    </I18nProvider>
  );
};

// Helper without route params
const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>{component}</MemoryRouter>
    </I18nProvider>
  );
};

describe("GuardBooksPage", () => {
  const mockGuardBooks: GuardBook[] = [
    {
      id: "gb-1",
      title: "Main Entrance Guard Book",
      description: "Guard book for main entrance security post",
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "gb-2",
      title: "Parking Lot Guard Book",
      description: "Guard book for parking lot patrols",
      is_active: true,
      created_at: "2025-01-02T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(guardBookApi.listGuardBooks).mockResolvedValue({
      data: mockGuardBooks,
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 2 },
    });
    vi.mocked(guardBookApi.getGuardBookReports).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 0 },
    });
  });

  it("renders page heading", async () => {
    renderWithRoute("cust-1", "obj-1");

    expect(
      screen.getByRole("heading", { name: "Guard Books" })
    ).toBeInTheDocument();
  });

  it("renders page description", async () => {
    renderWithRoute("cust-1", "obj-1");

    expect(
      screen.getByText(/Manage digital guard books and generate reports/)
    ).toBeInTheDocument();
  });

  it("shows breadcrumb navigation", async () => {
    renderWithRoute("cust-1", "obj-1");

    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Objects")).toBeInTheDocument();
    // Guard Books appears in both breadcrumb and heading
    const guardBooksElements = screen.getAllByText("Guard Books");
    expect(guardBooksElements.length).toBeGreaterThanOrEqual(2);
  });

  it("loads guard books for object", async () => {
    renderWithRoute("cust-1", "obj-1");

    await waitFor(() => {
      expect(guardBookApi.listGuardBooks).toHaveBeenCalledWith({
        object_id: "obj-1",
        object_area_id: undefined,
        per_page: 100,
      });
    });
  });

  it("loads guard books with area filter when areaId provided", async () => {
    renderWithRoute("cust-1", "obj-1", "area-1");

    await waitFor(() => {
      expect(guardBookApi.listGuardBooks).toHaveBeenCalledWith({
        object_id: "obj-1",
        object_area_id: "area-1",
        per_page: 100,
      });
    });
  });

  it("displays guard books in manager", async () => {
    renderWithRoute("cust-1", "obj-1");

    await waitFor(() => {
      expect(screen.getByText("Main Entrance Guard Book")).toBeInTheDocument();
      expect(screen.getByText("Parking Lot Guard Book")).toBeInTheDocument();
    });
  });

  it("shows error when no objectId is provided", async () => {
    renderWithProviders(<GuardBooksPage />);

    expect(screen.getByText(/No object selected/)).toBeInTheDocument();
    expect(screen.getByText("Go to Customers")).toBeInTheDocument();
  });

  it("shows link to customers page when no object selected", async () => {
    renderWithProviders(<GuardBooksPage />);

    const link = screen.getByRole("link", { name: "Go to Customers" });
    expect(link).toHaveAttribute("href", "/customers");
  });

  it("shows breadcrumb link to objects page", async () => {
    renderWithRoute("cust-1", "obj-1");

    const objectsLink = screen.getByRole("link", { name: "Objects" });
    expect(objectsLink).toHaveAttribute("href", "/customers/cust-1/objects");
  });
});
