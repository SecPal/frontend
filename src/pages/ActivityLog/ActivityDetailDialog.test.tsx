// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import { ActivityDetailDialog } from "./ActivityDetailDialog";
import * as activityLogApi from "../../services/activityLogApi";
import type {
  Activity,
  ActivityVerification,
} from "../../services/activityLogApi";

// Mock the activity log API
vi.mock("../../services/activityLogApi");

// Helper to render with providers
const renderWithProviders = (props: {
  activity: Activity;
  open: boolean;
  onClose: () => void;
}) => {
  return render(
    <I18nProvider i18n={i18n}>
      <ActivityDetailDialog {...props} />
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
  subject: { id: "user-1", name: "Test User" },
  causer_type: "App\\Models\\User",
  causer_id: "user-1",
  causer: { id: "user-1", name: "John Doe", email: "john@example.com" },
  properties: { ip: "192.168.1.1", user_agent: "Mozilla/5.0" },
  event_hash: "abc123def456",
  previous_hash: "previous-hash",
  security_level: 2,
  merkle_root: "merkle-root-hash",
  merkle_batch_id: "batch-123",
  merkle_proof: "proof-data",
  opentimestamp_proof: "ots-proof",
  opentimestamp_merkle_root: "ots-merkle-root",
  opentimestamp_proof_confirmed: true,
  ots_confirmed_at: "2025-12-27T12:00:00Z",
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

const mockVerification: ActivityVerification = {
  activity_id: "log-1",
  verification: {
    chain_valid: true,
    chain_link_valid: true,
    merkle_valid: true,
    ots_valid: true,
  },
  details: {
    event_hash: "abc123def456",
    previous_hash: "previous-hash",
    merkle_root: "merkle-root-hash",
    merkle_batch_id: "batch-123",
    ots_confirmed_at: "2025-12-27T12:00:00Z",
    is_orphaned_genesis: false,
    orphaned_reason: null,
  },
};

describe("ActivityDetailDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(activityLogApi.verifyActivityLog).mockResolvedValue({
      data: mockVerification,
    });
  });

  it("should not render when closed", () => {
    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: false, onClose });

    expect(screen.queryByText(/activity log details/i)).not.toBeInTheDocument();
  });

  it("should render dialog when open", async () => {
    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText(/activity log details/i)).toBeInTheDocument();
    });
  });

  it("should display activity information", async () => {
    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText("User logged in")).toBeInTheDocument();
    });

    expect(screen.getByText("default")).toBeInTheDocument();
    expect(screen.getByText("John Doe")).toBeInTheDocument();
    // Email is displayed in parentheses after name
    expect(screen.getByText(/\(john@example\.com\)/i)).toBeInTheDocument();
    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Enhanced")).toBeInTheDocument();
  });

  it("should fetch verification on open", async () => {
    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      expect(activityLogApi.verifyActivityLog).toHaveBeenCalledWith("log-1");
    });
  });

  it("should display verification badges when verified", async () => {
    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      const hashChainBadges = screen.getAllByText(/hash chain/i);
      expect(hashChainBadges.length).toBeGreaterThanOrEqual(1);
    });

    // Look for "Valid" text in badges
    const validBadges = screen.getAllByText(/valid/i);
    expect(validBadges.length).toBeGreaterThanOrEqual(3);
  });

  it("should display invalid verification status", async () => {
    vi.mocked(activityLogApi.verifyActivityLog).mockResolvedValue({
      data: {
        ...mockVerification,
        verification: {
          chain_valid: false,
          chain_link_valid: false,
          merkle_valid: false,
          ots_valid: false,
        },
      },
    });

    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      const hashChainBadges = screen.getAllByText(/hash chain/i);
      expect(hashChainBadges.length).toBeGreaterThanOrEqual(1);
    });

    const invalidBadges = screen.getAllByText(/invalid/i);
    expect(invalidBadges.length).toBeGreaterThanOrEqual(3);
  });

  it("should display Pending for null verification values", async () => {
    vi.mocked(activityLogApi.verifyActivityLog).mockResolvedValue({
      data: {
        ...mockVerification,
        verification: {
          chain_valid: true,
          chain_link_valid: true,
          merkle_valid: null,
          ots_valid: null,
        },
      },
    });

    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      const hashChainBadges = screen.getAllByText(/hash chain/i);
      expect(hashChainBadges.length).toBeGreaterThanOrEqual(1);
    });

    const pendingBadges = screen.getAllByText(/pending/i);
    expect(pendingBadges.length).toBeGreaterThanOrEqual(2);
  });

  it("should display verification error", async () => {
    vi.mocked(activityLogApi.verifyActivityLog).mockRejectedValue(
      new Error("Verification failed")
    );

    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    });
  });

  it("should display event hash", async () => {
    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText(/abc123def456/)).toBeInTheDocument();
    });
  });

  it("should display previous hash when present", async () => {
    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText(/previous-hash/)).toBeInTheDocument();
    });
  });

  it("should display merkle root when present", async () => {
    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText(/merkle-root-hash/)).toBeInTheDocument();
    });
  });

  it("should display merkle batch ID when present", async () => {
    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText("batch-123")).toBeInTheDocument();
    });
  });

  it("should call onClose when close button is clicked", async () => {
    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText(/activity log details/i)).toBeInTheDocument();
    });

    const closeButton = screen.getByRole("button", { name: /close/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("should display subject information", async () => {
    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText("Test User")).toBeInTheDocument();
    });

    expect(screen.getByText(/user-1/)).toBeInTheDocument();
  });

  it("should handle activity without causer", async () => {
    const activityNoCauser: Activity = {
      ...mockActivity,
      causer: null,
      causer_type: null,
      causer_id: null,
    };

    const onClose = vi.fn();
    renderWithProviders({ activity: activityNoCauser, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText("User logged in")).toBeInTheDocument();
    });

    // Should not show causer section
    expect(screen.queryByText("John Doe")).not.toBeInTheDocument();
  });

  it("should handle activity without subject", async () => {
    const activityNoSubject: Activity = {
      ...mockActivity,
      subject: null,
      subject_type: null,
      subject_id: null,
    };

    const onClose = vi.fn();
    renderWithProviders({ activity: activityNoSubject, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText("User logged in")).toBeInTheDocument();
    });

    // Subject section should not be present
    expect(screen.queryByText("Test User")).not.toBeInTheDocument();
  });

  it("should handle activity without organizational unit", async () => {
    const activityNoUnit: Activity = {
      ...mockActivity,
      organizational_unit: null,
      organizational_unit_id: null,
    };

    const onClose = vi.fn();
    renderWithProviders({ activity: activityNoUnit, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText("User logged in")).toBeInTheDocument();
    });

    // Should not show Engineering
    expect(screen.queryByText("Engineering")).not.toBeInTheDocument();
  });

  it("should display security level Maximum correctly", async () => {
    const activityMaxSecurity: Activity = {
      ...mockActivity,
      security_level: 3,
    };

    const onClose = vi.fn();
    renderWithProviders({ activity: activityMaxSecurity, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText("Maximum")).toBeInTheDocument();
    });
  });

  it("should display security level Basic correctly", async () => {
    const activityBasicSecurity: Activity = {
      ...mockActivity,
      security_level: 1,
    };

    const onClose = vi.fn();
    renderWithProviders({
      activity: activityBasicSecurity,
      open: true,
      onClose,
    });

    await waitFor(() => {
      expect(screen.getByText("Basic")).toBeInTheDocument();
    });
  });

  it("should display verifying state", async () => {
    // Make verification never resolve
    vi.mocked(activityLogApi.verifyActivityLog).mockImplementation(
      () => new Promise(() => {})
    );

    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText(/verifying/i)).toBeInTheDocument();
    });
  });

  it("should handle activity with no merkle data", async () => {
    const activityWithoutMerkle: Activity = {
      ...mockActivity,
      merkle_root: null,
      merkle_batch_id: null,
      merkle_proof: null,
    };

    // Mock successful verification even without merkle data
    vi.mocked(activityLogApi.verifyActivityLog).mockResolvedValue({
      data: {
        ...mockVerification,
        verification: {
          chain_valid: true,
          chain_link_valid: true,
          merkle_valid: false,
          ots_valid: false,
        },
      },
    });

    const onClose = vi.fn();
    renderWithProviders({
      activity: activityWithoutMerkle,
      open: true,
      onClose,
    });

    await waitFor(() => {
      expect(screen.getByText("Activity Log Details")).toBeInTheDocument();
    });
  });

  it("should handle activity with no OpenTimestamp proof", async () => {
    const activityWithoutOTS: Activity = {
      ...mockActivity,
      opentimestamp_proof: null,
    };

    // Mock verification without OTS
    vi.mocked(activityLogApi.verifyActivityLog).mockResolvedValue({
      data: {
        ...mockVerification,
        verification: {
          chain_valid: true,
          chain_link_valid: true,
          merkle_valid: true,
          ots_valid: false,
        },
      },
    });

    const onClose = vi.fn();
    renderWithProviders({ activity: activityWithoutOTS, open: true, onClose });

    await waitFor(() => {
      expect(screen.getByText("Activity Log Details")).toBeInTheDocument();
    });
  });

  it("should handle verification errors gracefully", async () => {
    // Mock verification to fail
    vi.mocked(activityLogApi.verifyActivityLog).mockRejectedValue(
      new Error("Verification failed")
    );

    const onClose = vi.fn();
    renderWithProviders({ activity: mockActivity, open: true, onClose });

    // Should still render the dialog even with verification error
    await waitFor(() => {
      expect(screen.getByText("Activity Log Details")).toBeInTheDocument();
    });
  });
});
