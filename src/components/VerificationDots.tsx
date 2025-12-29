// SPDX-FileCopyrightText: 2025 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg, Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import type {
  Activity,
  ActivityVerification,
} from "../services/activityLogApi";

interface VerificationDotsProps {
  activity: Activity;
  verification?: ActivityVerification;
  /** Size of the dots: "sm" for w-2 h-2, "md" for w-3 h-3 */
  size?: "sm" | "md";
  /** Whether to show text labels next to the dots */
  showLabels?: boolean;
}

/**
 * Verification status dots component
 * Shows color-coded dots based on security level:
 * - Level 1: Hash Chain only (2 dots: data integrity + link integrity)
 * - Level 2: Hash Chain + Merkle Tree
 * - Level 3: Hash Chain + Merkle Tree + OpenTimestamp
 */
export function VerificationDots({
  activity,
  verification,
  size = "md",
  showLabels = true,
}: VerificationDotsProps) {
  const { _ } = useLingui();
  const security_level = activity.security_level;
  const verificationData = verification?.verification || activity.verification;

  // Dot size classes based on size prop
  const dotSize = size === "sm" ? "w-2 h-2" : "w-3 h-3";

  // Helper to render a dot
  const renderDot = (
    status: boolean | null | undefined,
    label: string,
    notApplicable = false
  ) => {
    // Not applicable for this security level -> grey
    if (notApplicable) {
      return (
        <span
          className={`inline-block ${dotSize} rounded-full bg-zinc-300 dark:bg-zinc-600`}
          title={_(msg`${label}: N/A`)}
        />
      );
    }

    // Valid -> green
    if (status === true) {
      return (
        <span
          className={`inline-block ${dotSize} rounded-full bg-lime-500`}
          title={_(msg`${label}: Valid`)}
        />
      );
    }

    // Invalid -> red
    if (status === false) {
      return (
        <span
          className={`inline-block ${dotSize} rounded-full bg-red-500`}
          title={_(msg`${label}: Invalid`)}
        />
      );
    }

    // null or undefined = pending -> yellow
    return (
      <span
        className={`inline-block ${dotSize} rounded-full bg-yellow-500`}
        title={_(msg`${label}: Pending`)}
      />
    );
  };

  return (
    <div className="flex gap-1 items-center">
      {/* Hash Chain - Data Integrity (always shown for all levels) */}
      <div className="flex items-center gap-1">
        {renderDot(verificationData?.chain_valid, _(msg`Hash Chain (Data)`))}
        {showLabels && (
          <span className="text-sm">
            <Trans>Hash Chain (Data)</Trans>
          </span>
        )}
      </div>

      {/* Hash Chain - Link Integrity (connection to predecessor) */}
      <div className="flex items-center gap-1">
        {renderDot(
          verificationData?.chain_link_valid,
          _(msg`Hash Chain (Link)`)
        )}
        {showLabels && (
          <span className="text-sm">
            <Trans>Hash Chain (Link)</Trans>
          </span>
        )}
      </div>

      {/* Merkle Tree - show if Level 2+, or if data exists */}
      {(security_level >= 2 ||
        verificationData?.merkle_valid !== undefined) && (
        <div className="flex items-center gap-1">
          {renderDot(verificationData?.merkle_valid, _(msg`Merkle Tree`))}
          {showLabels && (
            <span className="text-sm">
              <Trans>Merkle Tree</Trans>
            </span>
          )}
        </div>
      )}

      {/* OpenTimestamp - show if Level 3 only */}
      {security_level >= 3 ? (
        <div className="flex items-center gap-1">
          {renderDot(verificationData?.ots_valid, _(msg`OpenTimestamp`))}
          {showLabels && (
            <span className="text-sm">
              <Trans>OpenTimestamp</Trans>
            </span>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-1">
          <span
            className={`inline-block ${dotSize} rounded-full bg-zinc-300 dark:bg-zinc-600`}
            title={_(msg`OpenTimestamp: N/A`)}
          />
          {showLabels && (
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              <Trans>OpenTimestamp</Trans>{" "}
              <span className="text-xs">
                (<Trans>N/A</Trans>)
              </span>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
