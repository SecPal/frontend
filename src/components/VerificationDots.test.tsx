// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { I18nProvider } from "@lingui/react";
import { i18n } from "@lingui/core";
import type { Activity } from "../services/activityLogApi";
import { VerificationDots } from "./VerificationDots";

function renderWithI18n(component: React.ReactElement) {
  i18n.load("en", {});
  i18n.activate("en");
  return render(<I18nProvider i18n={i18n}>{component}</I18nProvider>);
}

const baseActivity: Activity = {
  id: "activity-1",
  tenant_id: "tenant-1",
  organizational_unit_id: null,
  log_name: "default",
  description: "Created employee",
  subject_type: null,
  subject_id: null,
  subject: null,
  causer_type: null,
  causer_id: null,
  causer: null,
  properties: null,
  event_hash: "hash",
  previous_hash: null,
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
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  organizational_unit: null,
  verification: {
    chain_valid: true,
    chain_link_valid: true,
    merkle_valid: true,
    ots_valid: null,
  },
};

describe("VerificationDots", () => {
  it("keeps verification dots on canonical status tokens", () => {
    renderWithI18n(
      <VerificationDots
        activity={baseActivity}
        verification={{
          activity_id: "activity-1",
          verification: {
            chain_valid: true,
            chain_link_valid: false,
            merkle_valid: null,
            ots_valid: true,
          },
          details: {
            event_hash: "hash",
            previous_hash: null,
            merkle_root: null,
            merkle_batch_id: null,
            ots_confirmed_at: null,
            is_orphaned_genesis: false,
            orphaned_reason: null,
          },
        }}
      />
    );

    const validDots = screen.getAllByTitle(/: Valid/i);
    const invalidDot = screen.getByTitle(/Hash Chain \(Link\): Invalid/i);
    const pendingDot = screen.getByTitle(/Merkle Tree: Pending/i);

    for (const dot of validDots) {
      expect(dot).toHaveClass("bg-primary");
      expect(dot.className).not.toContain("bg-lime-500");
    }

    expect(invalidDot).toHaveClass("bg-destructive");
    expect(invalidDot.className).not.toContain("bg-red-500");
    expect(pendingDot).toHaveClass("bg-muted-foreground");
    expect(pendingDot.className).not.toContain("bg-yellow-500");
  });

  it("keeps not-applicable verification dots on canonical muted tokens", () => {
    renderWithI18n(
      <VerificationDots
        activity={baseActivity}
        verification={{
          activity_id: "activity-1",
          verification: {
            chain_valid: true,
            chain_link_valid: true,
            merkle_valid: true,
            ots_valid: null,
          },
          details: {
            event_hash: "hash",
            previous_hash: null,
            merkle_root: null,
            merkle_batch_id: null,
            ots_confirmed_at: null,
            is_orphaned_genesis: false,
            orphaned_reason: null,
          },
        }}
      />
    );

    const pendingDot = screen.getByTitle(/OpenTimestamp: Pending/i);
    expect(pendingDot.className).not.toContain("bg-zinc-300");
    expect(pendingDot.className).not.toContain("bg-zinc-600");
  });
});
