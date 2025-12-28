// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";
import { Trans } from "@lingui/macro";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from "../../components/dialog";
import { Button } from "../../components/button";
import { Badge } from "../../components/badge";
import { Text } from "../../components/text";
import { Heading } from "../../components/heading";
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from "../../components/description-list";
import {
  verifyActivityLog,
  type Activity,
  type ActivityVerification,
} from "../../services/activityLogApi";

interface ActivityDetailDialogProps {
  activity: Activity;
  open: boolean;
  onClose: () => void;
}

/**
 * Verification status badge
 */
function VerificationBadge({
  status,
  label,
}: {
  status: boolean | null;
  label: string;
}) {
  if (status === null) {
    return (
      <Badge color="zinc">
        {label}: <Trans>N/A</Trans>
      </Badge>
    );
  }

  return (
    <Badge color={status ? "lime" : "red"}>
      {label}: {status ? <Trans>Valid</Trans> : <Trans>Invalid</Trans>}
    </Badge>
  );
}

/**
 * Format date for display
 */
function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

/**
 * Activity Detail Dialog
 *
 * Displays comprehensive activity log details with verification status.
 * Shows:
 * - Basic activity information (description, causer, subject)
 * - Hash chain verification status
 * - Merkle tree proof verification (if available)
 * - OpenTimestamp proof verification (if available)
 * - Orphaned genesis information (if applicable)
 */
export function ActivityDetailDialog({
  activity,
  open,
  onClose,
}: ActivityDetailDialogProps) {
  const [verification, setVerification] = useState<ActivityVerification | null>(
    null
  );
  const [verifying, setVerifying] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );

  // Load verification status when dialog opens
  useEffect(() => {
    if (!open) return;

    async function loadVerification() {
      try {
        setVerifying(true);
        setVerificationError(null);
        const response = await verifyActivityLog(activity.id);
        setVerification(response.data);
      } catch (err) {
        console.error("Failed to verify activity log:", err);
        setVerificationError(
          err instanceof Error ? err.message : "Verification failed"
        );
      } finally {
        setVerifying(false);
      }
    }

    loadVerification();
  }, [activity.id, open]);

  return (
    <Dialog open={open} onClose={onClose} size="3xl">
      <DialogTitle>
        <Trans>Activity Log Details</Trans>
      </DialogTitle>
      <DialogDescription>
        <Trans>View activity log information and verification status</Trans>
      </DialogDescription>

      <DialogBody>
        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <Heading level={3} className="mb-4">
              <Trans>Activity Information</Trans>
            </Heading>
            <DescriptionList>
              <DescriptionTerm>
                <Trans>Description</Trans>
              </DescriptionTerm>
              <DescriptionDetails>{activity.description}</DescriptionDetails>

              <DescriptionTerm>
                <Trans>Log Name</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                <Badge color="zinc">{activity.log_name}</Badge>
              </DescriptionDetails>

              <DescriptionTerm>
                <Trans>Date/Time</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                {formatDateTime(activity.created_at)}
              </DescriptionDetails>

              <DescriptionTerm>
                <Trans>Security Level</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                <Badge
                  color={
                    activity.security_level === 3
                      ? "lime"
                      : activity.security_level === 2
                        ? "yellow"
                        : "zinc"
                  }
                >
                  {activity.security_level === 3 && <Trans>Maximum</Trans>}
                  {activity.security_level === 2 && <Trans>Enhanced</Trans>}
                  {activity.security_level === 1 && <Trans>Basic</Trans>}
                </Badge>
              </DescriptionDetails>

              {activity.causer && (
                <>
                  <DescriptionTerm>
                    <Trans>Causer</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {activity.causer.name}{" "}
                    {activity.causer.email && (
                      <span className="text-zinc-500 dark:text-zinc-400">
                        ({activity.causer.email})
                      </span>
                    )}
                  </DescriptionDetails>
                </>
              )}

              {activity.subject && (
                <>
                  <DescriptionTerm>
                    <Trans>Subject</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {activity.subject.name || activity.subject_type}
                    <span className="text-zinc-500 dark:text-zinc-400 ml-2">
                      (ID: {activity.subject.id})
                    </span>
                  </DescriptionDetails>
                </>
              )}

              {activity.organizational_unit && (
                <>
                  <DescriptionTerm>
                    <Trans>Organizational Unit</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {activity.organizational_unit.name}
                  </DescriptionDetails>
                </>
              )}
            </DescriptionList>
          </div>

          {/* Verification Status */}
          <div>
            <Heading level={3} className="mb-4">
              <Trans>Verification Status</Trans>
            </Heading>

            {verifying && (
              <Text className="text-zinc-500 dark:text-zinc-400">
                <Trans>Verifying...</Trans>
              </Text>
            )}

            {verificationError && (
              <div className="p-4 bg-red-50 dark:bg-red-900/10 rounded-md">
                <Text className="text-red-800 dark:text-red-200">
                  {verificationError}
                </Text>
              </div>
            )}

            {verification && !verifying && (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <VerificationBadge
                    status={verification.verification.chain_valid}
                    label="Hash Chain"
                  />
                  <VerificationBadge
                    status={verification.verification.merkle_valid}
                    label="Merkle Tree"
                  />
                  <VerificationBadge
                    status={verification.verification.ots_valid}
                    label="OpenTimestamp"
                  />
                </div>

                <DescriptionList>
                  <DescriptionTerm>
                    <Trans>Event Hash</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    <code className="text-xs break-all">
                      {verification.details.event_hash}
                    </code>
                  </DescriptionDetails>

                  {verification.details.previous_hash && (
                    <>
                      <DescriptionTerm>
                        <Trans>Previous Hash</Trans>
                      </DescriptionTerm>
                      <DescriptionDetails>
                        <code className="text-xs break-all">
                          {verification.details.previous_hash}
                        </code>
                      </DescriptionDetails>
                    </>
                  )}

                  {verification.details.merkle_root && (
                    <>
                      <DescriptionTerm>
                        <Trans>Merkle Root</Trans>
                      </DescriptionTerm>
                      <DescriptionDetails>
                        <code className="text-xs break-all">
                          {verification.details.merkle_root}
                        </code>
                      </DescriptionDetails>
                    </>
                  )}

                  {verification.details.merkle_batch_id && (
                    <>
                      <DescriptionTerm>
                        <Trans>Merkle Batch ID</Trans>
                      </DescriptionTerm>
                      <DescriptionDetails>
                        {verification.details.merkle_batch_id}
                      </DescriptionDetails>
                    </>
                  )}

                  {verification.details.ots_confirmed_at && (
                    <>
                      <DescriptionTerm>
                        <Trans>OpenTimestamp Confirmed</Trans>
                      </DescriptionTerm>
                      <DescriptionDetails>
                        {formatDateTime(verification.details.ots_confirmed_at)}
                      </DescriptionDetails>
                    </>
                  )}

                  {verification.details.is_orphaned_genesis && (
                    <>
                      <DescriptionTerm>
                        <Trans>Orphaned Genesis</Trans>
                      </DescriptionTerm>
                      <DescriptionDetails>
                        <Badge color="yellow">
                          <Trans>Yes</Trans>
                        </Badge>
                        {verification.details.orphaned_reason && (
                          <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            {verification.details.orphaned_reason}
                          </Text>
                        )}
                      </DescriptionDetails>
                    </>
                  )}
                </DescriptionList>

                {/* Explanation */}
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-md">
                  <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                    <Trans>
                      <strong>Hash Chain:</strong> Verifies the sequential
                      integrity of activity logs.
                      <br />
                      <strong>Merkle Tree:</strong> Batch verification for
                      efficient proof of log inclusion (Security Levels 2-3).
                      <br />
                      <strong>OpenTimestamp:</strong> Bitcoin blockchain
                      anchoring for immutable proof of existence (Security Level
                      3).
                    </Trans>
                  </Text>
                </div>
              </div>
            )}
          </div>

          {/* Properties (if any) */}
          {activity.properties &&
            Object.keys(activity.properties).length > 0 && (
              <div>
                <Heading level={3} className="mb-4">
                  <Trans>Additional Properties</Trans>
                </Heading>
                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-md">
                  <pre className="text-xs overflow-auto">
                    {JSON.stringify(activity.properties, null, 2)}
                  </pre>
                </div>
              </div>
            )}
        </div>
      </DialogBody>

      <DialogActions>
        <Button outline onClick={onClose}>
          <Trans>Close</Trans>
        </Button>
      </DialogActions>
    </Dialog>
  );
}
