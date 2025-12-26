// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { LeadershipLevelList } from "./LeadershipLevelList";
import * as leadershipLevelApi from "../services/leadershipLevelApi";
import type { LeadershipLevel } from "../types/leadershipLevel";

// Mock the API module
vi.mock("../services/leadershipLevelApi");

// Initialize i18n for tests
i18n.load("en", {});
i18n.activate("en");

describe("LeadershipLevelList", () => {
  const mockLevels: LeadershipLevel[] = [
    {
      id: "level-1",
      tenant_id: 1,
      rank: 1,
      name: "Managing Director",
      description: "CEO",
      color: "#FF5733",
      is_active: true,
      employees_count: 5,
      created_at: "2025-12-21T00:00:00Z",
      updated_at: "2025-12-21T00:00:00Z",
    },
    {
      id: "level-2",
      tenant_id: 1,
      rank: 2,
      name: "Regional CEO",
      description: "Regional Manager",
      color: "#33FF57",
      is_active: true,
      employees_count: 12,
      created_at: "2025-12-21T00:00:00Z",
      updated_at: "2025-12-21T00:00:00Z",
    },
    {
      id: "level-3",
      tenant_id: 1,
      rank: 3,
      name: "Branch Director",
      description: "Branch Manager",
      color: "#3357FF",
      is_active: false,
      employees_count: 0,
      deleted_at: "2025-12-22T00:00:00Z",
      created_at: "2025-12-21T00:00:00Z",
      updated_at: "2025-12-22T00:00:00Z",
    },
  ];

  const mockOnEdit = vi.fn();
  const mockOnCreate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rendering", () => {
    it("should render loading state initially", () => {
      vi.mocked(leadershipLevelApi.fetchLeadershipLevels).mockImplementation(
        () => new Promise(() => {}) // Never resolves
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelList onEdit={mockOnEdit} onCreate={mockOnCreate} />
        </I18nProvider>
      );

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
    });

    it("should render list of leadership levels", async () => {
      vi.mocked(leadershipLevelApi.fetchLeadershipLevels).mockResolvedValueOnce(
        {
          data: mockLevels.filter((l) => !l.deleted_at),
          meta: {
            current_page: 1,
            last_page: 1,
            per_page: 15,
            total: 2,
          },
        }
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelList onEdit={mockOnEdit} onCreate={mockOnCreate} />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Managing Director")).toBeInTheDocument();
      });

      expect(screen.getByText("Regional CEO")).toBeInTheDocument();
      expect(screen.queryByText("Branch Director")).not.toBeInTheDocument(); // Soft deleted
    });

    it("should render empty state when no levels exist", async () => {
      vi.mocked(leadershipLevelApi.fetchLeadershipLevels).mockResolvedValueOnce(
        {
          data: [],
          meta: {
            current_page: 1,
            last_page: 1,
            per_page: 15,
            total: 0,
          },
        }
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelList onEdit={mockOnEdit} onCreate={mockOnCreate} />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/no leadership levels/i)).toBeInTheDocument();
      });
    });

    it("should display color badges for each level", async () => {
      vi.mocked(leadershipLevelApi.fetchLeadershipLevels).mockResolvedValueOnce(
        {
          data: mockLevels.filter((l) => !l.deleted_at),
          meta: {
            current_page: 1,
            last_page: 1,
            per_page: 15,
            total: 2,
          },
        }
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelList onEdit={mockOnEdit} onCreate={mockOnCreate} />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Managing Director")).toBeInTheDocument();
      });

      // Check that rank badges are rendered (FE1, FE2)
      expect(screen.getByText("FE1")).toBeInTheDocument();
      expect(screen.getByText("FE2")).toBeInTheDocument();

      // Check that status badges are rendered
      const activeBadges = screen.getAllByText("Active");
      expect(activeBadges.length).toBe(2);
    });

    it("should show employees count for each level", async () => {
      vi.mocked(leadershipLevelApi.fetchLeadershipLevels).mockResolvedValueOnce(
        {
          data: mockLevels.filter((l) => !l.deleted_at),
          meta: {
            current_page: 1,
            last_page: 1,
            per_page: 15,
            total: 2,
          },
        }
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelList onEdit={mockOnEdit} onCreate={mockOnCreate} />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Managing Director")).toBeInTheDocument();
      });

      expect(screen.getByText(/5/)).toBeInTheDocument(); // 5 employees
      expect(screen.getByText(/12/)).toBeInTheDocument(); // 12 employees
    });
  });

  describe("CRUD Actions", () => {
    it("should call onCreate when Create button clicked", async () => {
      vi.mocked(leadershipLevelApi.fetchLeadershipLevels).mockResolvedValueOnce(
        {
          data: [],
          meta: {
            current_page: 1,
            last_page: 1,
            per_page: 15,
            total: 0,
          },
        }
      );

      const user = userEvent.setup();
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelList onEdit={mockOnEdit} onCreate={mockOnCreate} />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/no leadership levels/i)).toBeInTheDocument();
      });

      const createButton = screen.getByRole("button", { name: /create/i });
      await user.click(createButton);

      expect(mockOnCreate).toHaveBeenCalledTimes(1);
    });

    it("should call onEdit when Edit action clicked", async () => {
      const testLevel = mockLevels[0]!;
      vi.mocked(leadershipLevelApi.fetchLeadershipLevels).mockResolvedValueOnce(
        {
          data: [testLevel],
          meta: {
            current_page: 1,
            last_page: 1,
            per_page: 15,
            total: 1,
          },
        }
      );

      const user = userEvent.setup();
      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelList onEdit={mockOnEdit} onCreate={mockOnCreate} />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Managing Director")).toBeInTheDocument();
      });

      // Find dropdown button (ellipsis icon) and click it
      const dropdownButtons = screen.getAllByRole("button");
      const dropdownButton = dropdownButtons.find((btn) =>
        btn.querySelector("svg")
      );

      if (!dropdownButton) {
        throw new Error("Dropdown button not found");
      }

      await user.click(dropdownButton);

      // Wait for dropdown menu and click Edit
      const editButton = await screen.findByRole("menuitem", { name: /edit/i });
      await user.click(editButton);

      expect(mockOnEdit).toHaveBeenCalledWith(testLevel);
    });
  });

  describe("Error Handling", () => {
    it("should display error message when fetch fails", async () => {
      vi.mocked(leadershipLevelApi.fetchLeadershipLevels).mockRejectedValueOnce(
        new Error("Network error")
      );

      render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelList onEdit={mockOnEdit} onCreate={mockOnCreate} />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/failed to load/i)).toBeInTheDocument();
      });
    });
  });

  describe("Refresh Trigger", () => {
    it("should reload levels when refreshTrigger prop changes", async () => {
      const testLevel = mockLevels[0]!;
      vi.mocked(leadershipLevelApi.fetchLeadershipLevels).mockResolvedValue({
        data: [testLevel],
        meta: {
          current_page: 1,
          last_page: 1,
          per_page: 15,
          total: 1,
        },
      });

      const { rerender } = render(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelList
            onEdit={mockOnEdit}
            onCreate={mockOnCreate}
            refreshTrigger={1}
          />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(screen.getByText("Managing Director")).toBeInTheDocument();
      });

      expect(leadershipLevelApi.fetchLeadershipLevels).toHaveBeenCalledTimes(1);

      // Change refreshTrigger
      rerender(
        <I18nProvider i18n={i18n}>
          <LeadershipLevelList
            onEdit={mockOnEdit}
            onCreate={mockOnCreate}
            refreshTrigger={2}
          />
        </I18nProvider>
      );

      await waitFor(() => {
        expect(leadershipLevelApi.fetchLeadershipLevels).toHaveBeenCalledTimes(
          2
        );
      });
    });
  });
});
