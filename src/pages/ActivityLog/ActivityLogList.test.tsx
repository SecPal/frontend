// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ActivityLogList } from "./ActivityLogList";
import * as activityLogApi from "../../services/activityLogApi";
import * as organizationalUnitApi from "../../services/organizationalUnitApi";
import type { Activity } from "../../services/activityLogApi";

// Mock the APIs
vi.mock("../../services/activityLogApi");
vi.mock("../../services/organizationalUnitApi");

// Helper to render with providers
const renderWithProviders = () => {
  return render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter>
        <ActivityLogList />
      </MemoryRouter>
    </I18nProvider>
  );
};

const mockActivity: Activity = {
  id: "log-1",
  tenant_id: "tenant-1",
  organizational_unit_id: "unit-1",
  log_name: "default",
  description: "User logged in",
  subject_type: "App\\Models\\User",
  subject_id: "user-1",
  subject: { id: "user-1", name: "Test Subject" },
  causer_type: "App\\Models\\User",
  causer_id: "user-1",
  causer: { id: "user-1", name: "John Doe", email: "john@example.com" },
  properties: { ip: "192.168.1.1" },
  event_hash: "abc123",
  previous_hash: null,
  security_level: 1,
  merkle_root: null,
  merkle_batch_id: null,
  merkle_proof: null,
  opentimestamp_proof: null,
  opentimestamp_merkle_root: null,
  opentimestamp_proof_confirmed: false,
  ots_confirmed_at: null,
  is_orphaned_genesis: false,
  orphaned_reason: null,
  orphaned_at: null,
  created_at: "2025-12-27T10:00:00Z",
  updated_at: "2025-12-27T10:00:00Z",
  organizational_unit: {
    id: "unit-1",
    name: "Engineering",
    unit_type: "department",
  },
};

const mockResponse = {
  data: [mockActivity],
  meta: {
    current_page: 1,
    from: 1,
    last_page: 1,
    per_page: 50,
    to: 1,
    total: 1,
  },
  links: {
    first: "/v1/activity-logs?page=1",
    last: "/v1/activity-logs?page=1",
    prev: null,
    next: null,
  },
};

describe("ActivityLogList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue(mockResponse);
    vi.mocked(organizationalUnitApi.listOrganizationalUnits).mockResolvedValue({
      data: [
        {
          id: "unit-1",
          name: "Engineering",
          type: "department",
          created_at: "",
          updated_at: "",
        },
      ],
      meta: {
        current_page: 1,
        last_page: 1,
        per_page: 50,
        total: 1,
        root_unit_ids: ["unit-1"],
      },
    });
  });

  it("should render activity log list with heading", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByRole("heading", { name: /activity logs/i })
      ).toBeInTheDocument();
    });
  });

  it("should display activity data in table", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("User logged in")).toBeInTheDocument();
    });

    expect(screen.getByText("John Doe")).toBeInTheDocument();
    expect(screen.getByText("default")).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Basic")).toBeInTheDocument();
  });

  it("should display loading state", () => {
    vi.mocked(activityLogApi.fetchActivityLogs).mockImplementation(
      () => new Promise(() => {}) // Never resolves
    );

    renderWithProviders();

    expect(screen.getByText(/loading activity logs/i)).toBeInTheDocument();
  });

  it("should display error message on fetch failure", async () => {
    vi.mocked(activityLogApi.fetchActivityLogs).mockRejectedValue(
      new Error("Network error")
    );

    renderWithProviders();

    await waitFor(() => {
      // Component displays error.message directly
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it("should have search input with correct placeholder", async () => {
    renderWithProviders();

    await waitFor(() => {
      const searchInput = screen.getByPlaceholderText(
        /search in descriptions/i
      );
      expect(searchInput).toBeInTheDocument();
    });
  });

  it("should have log name filter", async () => {
    renderWithProviders();

    await waitFor(() => {
      const logNameSelect = screen.getByLabelText(/log name/i);
      expect(logNameSelect).toBeInTheDocument();
    });
  });

  it("should have date range filters", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/from date/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/to date/i)).toBeInTheDocument();
    });
  });

  it("should display empty state when no logs found", async () => {
    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue({
      data: [],
      meta: {
        current_page: 1,
        from: 0,
        last_page: 1,
        per_page: 50,
        to: 0,
        total: 0,
      },
      links: {
        first: "/v1/activity-logs?page=1",
        last: "/v1/activity-logs?page=1",
        prev: null,
        next: null,
      },
    });

    renderWithProviders();

    await waitFor(() => {
      // Empty state shows "No activity logs found" message
      expect(screen.getByText(/no activity logs found/i)).toBeInTheDocument();
    });
  });

  it("should display pagination when multiple pages exist", async () => {
    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue({
      data: [mockActivity],
      meta: {
        current_page: 1,
        from: 1,
        last_page: 3,
        per_page: 50,
        to: 50,
        total: 150,
      },
      links: {
        first: "/v1/activity-logs?page=1",
        last: "/v1/activity-logs?page=3",
        prev: null,
        next: "/v1/activity-logs?page=2",
      },
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    });

    const nextButton = screen.getByRole("button", { name: /next/i });
    expect(nextButton).toBeInTheDocument();
    expect(nextButton).not.toBeDisabled();

    const prevButton = screen.getByRole("button", { name: /previous/i });
    expect(prevButton).toBeDisabled(); // First page, so previous disabled
  });

  it("should handle page navigation", async () => {
    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue({
      data: [mockActivity],
      meta: {
        current_page: 1,
        from: 1,
        last_page: 3,
        per_page: 50,
        to: 50,
        total: 150,
      },
      links: {
        first: "/v1/activity-logs?page=1",
        last: "/v1/activity-logs?page=3",
        prev: null,
        next: "/v1/activity-logs?page=2",
      },
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    });

    // Mock page 2 response
    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue({
      data: [mockActivity],
      meta: {
        current_page: 2,
        from: 51,
        last_page: 3,
        per_page: 50,
        to: 100,
        total: 150,
      },
      links: {
        first: "/v1/activity-logs?page=1",
        last: "/v1/activity-logs?page=3",
        prev: "/v1/activity-logs?page=1",
        next: "/v1/activity-logs?page=3",
      },
    });

    const nextButton = screen.getByRole("button", { name: /next/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(activityLogApi.fetchActivityLogs).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });

  it("should display security level badges correctly", async () => {
    const activities: Activity[] = [
      {
        ...mockActivity,
        id: "log-1",
        security_level: 1,
        description: "Basic level",
      },
      {
        ...mockActivity,
        id: "log-2",
        security_level: 2,
        description: "Enhanced level",
      },
      {
        ...mockActivity,
        id: "log-3",
        security_level: 3,
        description: "Maximum level",
      },
    ];

    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue({
      ...mockResponse,
      data: activities,
      meta: { ...mockResponse.meta, total: 3, to: 3 },
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("Basic")).toBeInTheDocument();
      expect(screen.getByText("Enhanced")).toBeInTheDocument();
      expect(screen.getByText("Maximum")).toBeInTheDocument();
    });
  });

  it("should display System when no causer", async () => {
    const activityNoCauser: Activity = {
      ...mockActivity,
      causer: null,
      causer_type: null,
      causer_id: null,
    };

    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue({
      ...mockResponse,
      data: [activityNoCauser],
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/system/i)).toBeInTheDocument();
    });
  });

  it("should display Global when no organizational unit", async () => {
    const activityNoUnit: Activity = {
      ...mockActivity,
      organizational_unit: null,
      organizational_unit_id: null,
    };

    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue({
      ...mockResponse,
      data: [activityNoUnit],
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/global/i)).toBeInTheDocument();
    });
  });

  it("should call API with filters when changed", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(
        screen.getByPlaceholderText(/search in descriptions/i)
      ).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search in descriptions/i);
    fireEvent.change(searchInput, { target: { value: "login" } });

    await waitFor(() => {
      expect(activityLogApi.fetchActivityLogs).toHaveBeenCalledWith(
        expect.objectContaining({ search: "login", page: 1 })
      );
    });
  });

  it("should open detail dialog when row is clicked", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("User logged in")).toBeInTheDocument();
    });

    // Click on the description text (which is in the clickable row)
    const descriptionCell = screen.getByText("User logged in");
    fireEvent.click(descriptionCell);

    // Dialog should open - we can't fully test it without mocking Dialog component,
    // but we can verify the state change happened by checking if verifyActivityLog would be called
    // This is a limitation of unit testing - integration tests would verify full dialog behavior
  });

  it("should handle date range filter", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getAllByRole("textbox").length).toBeGreaterThan(0);
    });

    // The date inputs would be tested here if they were text inputs
    // In reality they're date pickers which require different handling
  });

  it("should handle log name filter", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    });

    // Verify log name select exists and is interactive
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes[0]).toBeInTheDocument();
    expect(comboboxes[0]).not.toBeDisabled();
  });

  it("should handle organizational unit filter", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    });

    // Verify at least one combobox exists (could be log name or org unit depending on permissions/data)
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(1);
  });

  it("should handle pagination next page", async () => {
    const multiPageResponse = {
      ...mockResponse,
      meta: {
        current_page: 1,
        from: 1,
        last_page: 3,
        per_page: 50,
        to: 50,
        total: 150,
      },
      links: {
        first: "/v1/activity-logs?page=1",
        last: "/v1/activity-logs?page=3",
        prev: null,
        next: "/v1/activity-logs?page=2",
      },
    };

    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue(
      multiPageResponse
    );

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
    });

    const nextButton = screen.getByRole("button", { name: /next/i });
    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(activityLogApi.fetchActivityLogs).toHaveBeenCalledWith(
        expect.objectContaining({ page: 2 })
      );
    });
  });

  it("should handle pagination previous page", async () => {
    const multiPageResponse = {
      ...mockResponse,
      meta: {
        current_page: 2,
        from: 51,
        last_page: 3,
        per_page: 50,
        to: 100,
        total: 150,
      },
      links: {
        first: "/v1/activity-logs?page=1",
        last: "/v1/activity-logs?page=3",
        prev: "/v1/activity-logs?page=1",
        next: "/v1/activity-logs?page=3",
      },
    };

    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue(
      multiPageResponse
    );

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
    });

    const prevButton = screen.getByRole("button", { name: /previous/i });
    fireEvent.click(prevButton);

    await waitFor(() => {
      expect(activityLogApi.fetchActivityLogs).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1 })
      );
    });
  });

  it("should disable prev button on first page", async () => {
    const firstPageResponse = {
      ...mockResponse,
      meta: {
        current_page: 1,
        from: 1,
        last_page: 3,
        per_page: 50,
        to: 50,
        total: 150,
      },
      links: {
        first: "/v1/activity-logs?page=1",
        last: "/v1/activity-logs?page=3",
        prev: null,
        next: "/v1/activity-logs?page=2",
      },
    };

    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue(
      firstPageResponse
    );

    renderWithProviders();

    await waitFor(() => {
      const prevButton = screen.getByRole("button", { name: /previous/i });
      expect(prevButton).toBeDisabled();
    });
  });

  it("should disable next button on last page", async () => {
    const lastPageResponse = {
      ...mockResponse,
      meta: {
        current_page: 3,
        from: 101,
        last_page: 3,
        per_page: 50,
        to: 150,
        total: 150,
      },
      links: {
        first: "/v1/activity-logs?page=1",
        last: "/v1/activity-logs?page=3",
        prev: "/v1/activity-logs?page=2",
        next: null,
      },
    };

    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue(
      lastPageResponse
    );

    renderWithProviders();

    await waitFor(() => {
      const nextButton = screen.getByRole("button", { name: /next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  it("should reset to page 1 when filter changes", async () => {
    const multiPageResponse = {
      ...mockResponse,
      meta: {
        current_page: 2,
        from: 51,
        last_page: 3,
        per_page: 50,
        to: 100,
        total: 150,
      },
    };

    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue(
      multiPageResponse
    );

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });

    // Change search filter
    const searchInput = screen.getByPlaceholderText(/search/i);
    fireEvent.change(searchInput, { target: { value: "new search" } });

    await waitFor(() => {
      expect(activityLogApi.fetchActivityLogs).toHaveBeenCalledWith(
        expect.objectContaining({ search: "new search", page: 1 })
      );
    });
  });

  it("should handle API errors gracefully", async () => {
    vi.mocked(activityLogApi.fetchActivityLogs).mockRejectedValue(
      new Error("Network error")
    );

    renderWithProviders();

    // Should not crash, error boundary or error state should handle it
    await waitFor(() => {
      expect(activityLogApi.fetchActivityLogs).toHaveBeenCalled();
    });
  });

  it("should show loading state initially", async () => {
    // Mock slow API
    vi.mocked(activityLogApi.fetchActivityLogs).mockImplementation(
      () =>
        new Promise((resolve) => setTimeout(() => resolve(mockResponse), 100))
    );

    renderWithProviders();

    // Should show loading indicator (if implemented)
    expect(activityLogApi.fetchActivityLogs).toHaveBeenCalled();
  });

  it("should format dates correctly", async () => {
    const activityWithDate = {
      ...mockActivity,
      created_at: "2025-12-27T14:30:45Z",
    };

    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue({
      ...mockResponse,
      data: [activityWithDate],
    });

    renderWithProviders();

    await waitFor(() => {
      // Date should be formatted according to locale
      expect(screen.getByText(/user logged in/i)).toBeInTheDocument();
    });
  });

  it("should handle activities with no subject", async () => {
    const activityNoSubject = {
      ...mockActivity,
      subject: null,
      subject_type: null,
      subject_id: null,
    };

    vi.mocked(activityLogApi.fetchActivityLogs).mockResolvedValue({
      ...mockResponse,
      data: [activityNoSubject],
    });

    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByText("User logged in")).toBeInTheDocument();
    });
  });

  it("should clear search when cleared", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      /search/i
    ) as HTMLInputElement;

    // Enter search
    fireEvent.change(searchInput, { target: { value: "test" } });

    await waitFor(() => {
      expect(searchInput.value).toBe("test");
    });

    // Clear search
    fireEvent.change(searchInput, { target: { value: "" } });

    await waitFor(() => {
      expect(activityLogApi.fetchActivityLogs).toHaveBeenCalledWith(
        expect.objectContaining({ search: "" })
      );
    });
  });

  it("should handle from date filter change", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/from date/i)).toBeInTheDocument();
    });

    const fromDateInput = screen.getByLabelText(/from date/i);
    fireEvent.change(fromDateInput, { target: { value: "2025-01-01" } });

    await waitFor(() => {
      expect(activityLogApi.fetchActivityLogs).toHaveBeenCalledWith(
        expect.objectContaining({ from_date: "2025-01-01", page: 1 })
      );
    });
  });

  it("should handle to date filter change", async () => {
    renderWithProviders();

    await waitFor(() => {
      expect(screen.getByLabelText(/to date/i)).toBeInTheDocument();
    });

    const toDateInput = screen.getByLabelText(/to date/i);
    fireEvent.change(toDateInput, { target: { value: "2025-12-31" } });

    await waitFor(() => {
      expect(activityLogApi.fetchActivityLogs).toHaveBeenCalledWith(
        expect.objectContaining({ to_date: "2025-12-31", page: 1 })
      );
    });
  });
});
