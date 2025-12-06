// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { GuardBookManager } from "./GuardBookManager";
import type { GuardBook, PaginatedResponse } from "../types/organizational";

// Mock the API module
vi.mock("../services/guardBookApi", () => ({
  listGuardBooks: vi.fn(),
  deleteGuardBook: vi.fn(),
  listGuardBookReports: vi.fn(),
  generateGuardBookReport: vi.fn(),
}));

import { listGuardBooks, listGuardBookReports } from "../services/guardBookApi";

function renderWithI18n(component: React.ReactElement) {
  i18n.load("en", {});
  i18n.activate("en");
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

describe("GuardBookManager", () => {
  const mockGuardBooks: GuardBook[] = [
    {
      id: "gb-1",
      title: "Main Building Guard Book",
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "gb-2",
      title: "Warehouse Guard Book",
      is_active: true,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
    {
      id: "gb-3",
      title: "Archived Guard Book",
      is_active: false,
      created_at: "2025-01-01T00:00:00Z",
      updated_at: "2025-01-01T00:00:00Z",
    },
  ];

  const mockResponse: PaginatedResponse<GuardBook> = {
    data: mockGuardBooks,
    meta: { current_page: 1, last_page: 1, per_page: 15, total: 3 },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(listGuardBooks).mockResolvedValue(mockResponse);
    vi.mocked(listGuardBookReports).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 },
    });
  });

  it("renders loading state initially", async () => {
    renderWithI18n(<GuardBookManager objectId="obj-1" />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();

    // Wait for async operations to complete to prevent act() warnings
    await waitFor(() => {
      expect(document.querySelector(".animate-spin")).not.toBeInTheDocument();
    });
  });

  it("renders guard books after loading", async () => {
    renderWithI18n(<GuardBookManager objectId="obj-1" />);

    await waitFor(() => {
      expect(screen.getByText("Main Building Guard Book")).toBeInTheDocument();
    });

    expect(screen.getByText("Warehouse Guard Book")).toBeInTheDocument();
  });

  it("displays guard book status", async () => {
    renderWithI18n(<GuardBookManager objectId="obj-1" />);

    await waitFor(() => {
      expect(screen.getByText("Main Building Guard Book")).toBeInTheDocument();
    });

    // Active/inactive status should be displayed
    const activeBadges = screen.getAllByText("Active");
    expect(activeBadges.length).toBeGreaterThan(0);
  });

  it("renders empty state when no guard books", async () => {
    vi.mocked(listGuardBooks).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, per_page: 15, total: 0 },
    });

    renderWithI18n(<GuardBookManager objectId="obj-1" />);

    await waitFor(() => {
      expect(screen.getByText("No Guard Books")).toBeInTheDocument();
    });
  });

  it("shows error state on API failure", async () => {
    vi.mocked(listGuardBooks).mockRejectedValue(new Error("Failed to load"));

    renderWithI18n(<GuardBookManager objectId="obj-1" />);

    await waitFor(() => {
      expect(screen.getByText("Failed to load")).toBeInTheDocument();
    });
  });

  it("calls onSelect when guard book is clicked", async () => {
    const onSelect = vi.fn();
    renderWithI18n(<GuardBookManager objectId="obj-1" onSelect={onSelect} />);

    await waitFor(() => {
      expect(screen.getByText("Main Building Guard Book")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Main Building Guard Book"));

    expect(onSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "gb-1",
        title: "Main Building Guard Book",
      })
    );
  });

  it("shows create button when onCreate is provided", async () => {
    const onCreate = vi.fn();
    renderWithI18n(<GuardBookManager objectId="obj-1" onCreate={onCreate} />);

    await waitFor(() => {
      expect(screen.getByText("Create Guard Book")).toBeInTheDocument();
    });
  });

  it("filters guard books by object ID", async () => {
    renderWithI18n(<GuardBookManager objectId="obj-123" />);

    await waitFor(() => {
      expect(listGuardBooks).toHaveBeenCalledWith(
        expect.objectContaining({ object_id: "obj-123" })
      );
    });
  });

  it("filters guard books by area ID", async () => {
    renderWithI18n(
      <GuardBookManager objectId="obj-1" objectAreaId="area-456" />
    );

    await waitFor(() => {
      expect(listGuardBooks).toHaveBeenCalledWith(
        expect.objectContaining({ object_area_id: "area-456" })
      );
    });
  });

  it("shows inactive guard books differently", async () => {
    renderWithI18n(<GuardBookManager objectId="obj-1" />);

    await waitFor(() => {
      expect(screen.getByText("Archived Guard Book")).toBeInTheDocument();
    });

    // Inactive guard book should have inactive indicator
    expect(screen.getByText("Inactive")).toBeInTheDocument();
  });

  it("shows guard book actions on hover", async () => {
    const onEdit = vi.fn();
    renderWithI18n(<GuardBookManager objectId="obj-1" onEdit={onEdit} />);

    await waitFor(() => {
      expect(screen.getByText("Main Building Guard Book")).toBeInTheDocument();
    });

    // Edit button should exist
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    expect(editButtons.length).toBeGreaterThan(0);
  });

  it("shows generate report button", async () => {
    const onGenerateReport = vi.fn();
    renderWithI18n(
      <GuardBookManager objectId="obj-1" onGenerateReport={onGenerateReport} />
    );

    await waitFor(() => {
      expect(screen.getByText("Main Building Guard Book")).toBeInTheDocument();
    });

    // Generate report button should exist
    const reportButtons = screen.getAllByRole("button", {
      name: /generate report|report/i,
    });
    expect(reportButtons.length).toBeGreaterThan(0);
  });
});
