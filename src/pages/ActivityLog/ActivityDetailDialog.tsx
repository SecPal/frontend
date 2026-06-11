// SPDX-FileCopyrightText: 2025-2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, type ComponentPropsWithoutRef } from "react";
import { Trans } from "@lingui/react/macro";
import {
  Alert,
  Badge,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  cn,
} from "@/ui";
import {
  verifyActivityLog,
  type Activity,
  type ActivityVerification,
} from "../../services/activityLogApi";
import { VerificationDots } from "../../components/VerificationDots";
import { formatApiDateTime } from "../../lib/dateUtils";

interface ActivityDetailDialogProps {
  activity: Activity;
  open: boolean;
  onClose: () => void;
}

/**
 * Format date for display
 */
function formatDateTime(dateString: string): string {
  return formatApiDateTime(dateString, {
    formatOptions: {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
  });
}

function buildVerificationFromActivity(
  activity: Activity
): ActivityVerification | null {
  if (!activity.verification) {
    return null;
  }

  return {
    activity_id: activity.id,
    verification: activity.verification,
    details: {
      event_hash: activity.event_hash || "",
      previous_hash: activity.previous_hash || null,
      merkle_root: activity.merkle_root || null,
      merkle_batch_id: activity.merkle_batch_id?.toString() || null,
      ots_confirmed_at: activity.ots_confirmed_at || null,
      is_orphaned_genesis: activity.is_orphaned_genesis || false,
      orphaned_reason: activity.orphaned_reason || null,
    },
  };
}

function SectionHeading({
  className,
  ...props
}: ComponentPropsWithoutRef<"h3">) {
  return (
    <h3
      className={cn(
        "mb-4 text-base font-semibold tracking-normal text-zinc-950 dark:text-zinc-50",
        className
      )}
      {...props}
    />
  );
}

function DescriptionList(props: ComponentPropsWithoutRef<"dl">) {
  return (
    <dl
      className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-[12rem_minmax(0,1fr)]"
      {...props}
    />
  );
}

function DescriptionTerm(props: ComponentPropsWithoutRef<"dt">) {
  return (
    <dt
      className="text-sm font-medium text-zinc-600 dark:text-zinc-300"
      {...props}
    />
  );
}

function DescriptionDetails(props: ComponentPropsWithoutRef<"dd">) {
  return (
    <dd
      className="min-w-0 text-sm text-zinc-950 dark:text-zinc-50"
      {...props}
    />
  );
}

function LogBadge({ className, ...props }: ComponentPropsWithoutRef<"span">) {
  return (
    <Badge
      className={cn(
        "bg-zinc-600/10 text-zinc-700 dark:bg-white/5 dark:text-zinc-400",
        className
      )}
      {...props}
    />
  );
}

function ActivityDetailDialogContent({
  activity,
  onClose,
}: {
  activity: Activity;
  onClose: () => void;
}) {
  const initialVerification = buildVerificationFromActivity(activity);
  const [verification, setVerification] = useState<ActivityVerification | null>(
    initialVerification
  );
  const [verifying, setVerifying] = useState(initialVerification === null);
  const [verificationError, setVerificationError] = useState<string | null>(
    null
  );

  useEffect(() => {
    if (initialVerification) {
      return;
    }

    let active = true;

    void verifyActivityLog(activity.id)
      .then((response) => {
        if (active) {
          setVerification(response.data);
        }
      })
      .catch((err) => {
        if (active) {
          console.error("Failed to verify activity log:", err);
          setVerificationError(
            err instanceof Error ? err.message : "Verification failed"
          );
        }
      })
      .finally(() => {
        if (active) {
          setVerifying(false);
        }
      });

    return () => {
      active = false;
    };
  }, [activity.id, initialVerification]);

  return (
    <>
      <DialogBody>
        <div className="space-y-6">
          {/* Basic Information */}
          <div>
            <SectionHeading>
              <Trans>Activity Information</Trans>
            </SectionHeading>
            <DescriptionList>
              <DescriptionTerm>
                <Trans>Description</Trans>
              </DescriptionTerm>
              <DescriptionDetails>{activity.description}</DescriptionDetails>

              <DescriptionTerm>
                <Trans>Log Name</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                <LogBadge>{activity.log_name}</LogBadge>
              </DescriptionDetails>

              <DescriptionTerm>
                <Trans>Date/Time</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                {formatDateTime(activity.created_at)}
              </DescriptionDetails>

              {activity.causer && (
                <>
                  <DescriptionTerm>
                    <Trans>Causer</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {activity.causer.name}{" "}
                    {activity.causer.email && (
                      <span className="inline text-zinc-500 dark:text-zinc-400">
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
                    <span className="ml-2 inline text-zinc-500 dark:text-zinc-400">
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
            <SectionHeading>
              <Trans>Verification Status</Trans>
            </SectionHeading>

            {verifying && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                <Trans>Verifying...</Trans>
              </p>
            )}

            {verificationError && (
              <Alert className="border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-200">
                {verificationError}
              </Alert>
            )}

            {verification && !verifying && (
              <div className="space-y-4">
                <VerificationDots
                  activity={activity}
                  verification={verification}
                />

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
                        <code className="text-xs break-all">
                          {verification.details.merkle_batch_id}
                        </code>
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
                        <Badge className="bg-yellow-400/20 text-yellow-700 dark:bg-yellow-400/10 dark:text-yellow-300">
                          <Trans>Yes</Trans>
                        </Badge>
                        {verification.details.orphaned_reason && (
                          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                            {verification.details.orphaned_reason}
                          </p>
                        )}
                      </DescriptionDetails>
                    </>
                  )}
                </DescriptionList>

                <div className="p-4 bg-zinc-50 dark:bg-zinc-800/50 rounded-md">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    <Trans>
                      <strong>Hash Chain:</strong> Verifies the sequential
                      integrity of activity logs. "Pending" indicates the hash
                      chain is still being built.
                      <br />
                      <strong>Merkle Tree:</strong> Batch verification for
                      efficient proof of log inclusion. Runs every minute in
                      development, hourly in production.
                      <br />
                      <strong>OpenTimestamp:</strong> Bitcoin blockchain
                      anchoring for immutable proof of existence. Bitcoin
                      confirmation takes ~10 minutes.
                    </Trans>
                  </p>
                </div>
              </div>
            )}
          </div>

          {activity.properties &&
            Object.keys(activity.properties).length > 0 && (
              <div>
                <SectionHeading>
                  <Trans>Additional Properties</Trans>
                </SectionHeading>
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
        <Button variant="outline" onClick={onClose}>
          <Trans>Close</Trans>
        </Button>
      </DialogActions>
    </>
  );
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
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogPortal>
        <DialogOverlay />
        <DialogContent size="3xl">
          <DialogTitle>
            <Trans>Activity Log Details</Trans>
          </DialogTitle>
          <DialogDescription>
            <Trans>View activity log information and verification status</Trans>
          </DialogDescription>
          {open ? (
            <ActivityDetailDialogContent
              key={`${activity.id}:${activity.updated_at}`}
              activity={activity}
              onClose={onClose}
            />
          ) : null}
        </DialogContent>
      </DialogPortal>
    </Dialog>
  );
}
