// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ObjectsPage } from "./ObjectsPage";
import * as objectApi from "../../services/objectApi";
import type { SecPalObject } from "../../types";

// Mock the API
vi.mock("../../services/objectApi", () => ({
  listObjects: vi.fn(),
  getObjectAreas: vi.fn(),
}));

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    useNavigate: () => mockNavigate,
  };
});

// Helper to render with providers and route params
const renderWithRoute = (customerId: string) => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[`/customers/${customerId}/objects`]}>
        <Routes>
          <Route
            path="/customers/:customerId/objects"
            element={<ObjectsPage />}
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

describe("ObjectsPage", () => {
  const mockObjects: SecPalObject[] = [
    {
      id: "obj-1",
      object_number: "OBJ-001",
      name: "Headquarters Building",
      address: "123 Corporate Ave",
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "obj-2",
      object_number: "OBJ-002",
      name: "Warehouse A",
      address: "456 Industrial Blvd",
      created_at: "2025-01-02T00:00:00Z",
      updated_at: "2025-01-02T00:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(objectApi.listObjects).mockResolvedValue({
      data: mockObjects,
      meta: { current_page: 1, last_page: 1, per_page: 100, total: 2 },
    });
    vi.mocked(objectApi.getObjectAreas).mockResolvedValue([]);
  });

  it("renders page heading", async () => {
    renderWithRoute("cust-1");

    expect(screen.getByText("Objects & Areas")).toBeInTheDocument();
  });

  it("renders page description", async () => {
    renderWithRoute("cust-1");

    expect(
      screen.getByText(/Manage protected objects and their areas/)
    ).toBeInTheDocument();
  });

  it("shows breadcrumb navigation", async () => {
    renderWithRoute("cust-1");

    expect(screen.getByText("Customers")).toBeInTheDocument();
    expect(screen.getByText("Objects")).toBeInTheDocument();
  });

  it("loads objects for customer", async () => {
    renderWithRoute("cust-1");

    await waitFor(() => {
      expect(objectApi.listObjects).toHaveBeenCalledWith({
        customer_id: "cust-1",
        per_page: 100,
      });
    });
  });

  it("displays objects in manager", async () => {
    renderWithRoute("cust-1");

    await waitFor(() => {
      expect(screen.getByText("Headquarters Building")).toBeInTheDocument();
      expect(screen.getByText("Warehouse A")).toBeInTheDocument();
    });
  });

  it("shows error when no customerId is provided", async () => {
    // Render directly without route params
    renderWithProviders(<ObjectsPage />);

    expect(screen.getByText(/No customer selected/)).toBeInTheDocument();
    expect(screen.getByText("Go to Customers")).toBeInTheDocument();
  });

  it("shows link to customers page when no customer selected", async () => {
    renderWithProviders(<ObjectsPage />);

    const link = screen.getByRole("link", { name: "Go to Customers" });
    expect(link).toHaveAttribute("href", "/customers");
  });
});
