// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useState } from "react";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from "../../components/dialog";
import { Field, Label } from "../../components/fieldset";
import { Heading } from "../../components/heading";
import { Input } from "../../components/input";
import { MfaQrCode } from "../../components/MfaQrCode";
import { Select } from "../../components/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/table";
import { Text } from "../../components/text";
import { Textarea } from "../../components/textarea";
import { useUserCapabilities } from "../../hooks/useUserCapabilities";
import type {
  AndroidEnrollmentSession,
  AndroidProvisioningProfile,
  AndroidReleaseChannel,
  CreateAndroidEnrollmentSessionRequest,
} from "@/types/api";
import { ApiError } from "../../services/ApiError";
import {
  createAndroidEnrollmentSession,
  listAndroidEnrollmentSessions,
  revokeAndroidEnrollmentSession,
} from "../../services/androidEnrollmentApi";

const DEFAULT_PROVISIONING_PROFILE: AndroidProvisioningProfile = {
  kiosk_mode_enabled: true,
  lock_task_enabled: true,
  allow_phone: false,
  allow_sms: false,
  prefer_gesture_navigation: true,
  allowed_packages: ["app.secpal"],
};

type CreateFormState = {
  device_label: string;
  update_channel: AndroidReleaseChannel;
  expires_in_minutes: number;
  notes: string;
};

const INITIAL_FORM_STATE: CreateFormState = {
  device_label: "",
  update_channel: "managed_device",
  expires_in_minutes: 15,
  notes: "",
};

function formatDateTime(value: string | null): string {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString();
}

function getStatusBadgeColor(status: AndroidEnrollmentSession["status"]) {
  switch (status) {
    case "pending":
      return "sky" as const;
    case "exchanged":
      return "lime" as const;
    case "revoked":
      return "rose" as const;
    case "expired":
      return "amber" as const;
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

export default function AndroidProvisioningPage() {
  const { _ } = useLingui();
  const capabilities = useUserCapabilities();
  const [formState, setFormState] = useState<CreateFormState>(INITIAL_FORM_STATE);
  const [sessions, setSessions] = useState<AndroidEnrollmentSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const [revocationReason, setRevocationReason] = useState("");
  const [sessionToRevoke, setSessionToRevoke] = useState<AndroidEnrollmentSession | null>(null);
  const [latestProvisioningQrPayload, setLatestProvisioningQrPayload] = useState<string | null>(null);
  const [latestProvisioningSession, setLatestProvisioningSession] =
    useState<AndroidEnrollmentSession | null>(null);

  useEffect(() => {
    let isActive = true;

    async function loadSessions() {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await listAndroidEnrollmentSessions({ per_page: 15 });

        if (!isActive) {
          return;
        }

        setSessions(response.data);
      } catch (error) {
        if (!isActive) {
          return;
        }

        setLoadError(
          getErrorMessage(error, "Failed to load Android enrollment sessions")
        );
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadSessions();

    return () => {
      isActive = false;
    };
  }, []);

  async function handleCreateSession(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload: CreateAndroidEnrollmentSessionRequest = {
      device_label: formState.device_label.trim() || undefined,
      update_channel: formState.update_channel,
      expires_in_minutes: formState.expires_in_minutes,
      notes: formState.notes.trim() || undefined,
      provisioning_profile: DEFAULT_PROVISIONING_PROFILE,
    };

    setCreating(true);
    setSubmitError(null);

    try {
      const created = await createAndroidEnrollmentSession(payload);
      setSessions((current) => [created.session, ...current]);
      setLatestProvisioningSession(created.session);
      setLatestProvisioningQrPayload(created.provisioning_qr_payload);
      setFormState(INITIAL_FORM_STATE);
    } catch (error) {
      setSubmitError(
        getErrorMessage(error, "Failed to create Android enrollment session")
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleConfirmRevoke() {
    if (!sessionToRevoke) {
      return;
    }

    setRevoking(true);
    setRevokeError(null);

    try {
      const revokedSession = await revokeAndroidEnrollmentSession(
        sessionToRevoke.id,
        {
          reason: revocationReason,
        }
      );

      setSessions((current) =>
        current.map((session) =>
          session.id === revokedSession.id ? revokedSession : session
        )
      );
      setLatestProvisioningSession((current) =>
        current?.id === revokedSession.id ? revokedSession : current
      );
      setSessionToRevoke(null);
      setRevocationReason("");
    } catch (error) {
      setRevokeError(
        getErrorMessage(error, "Failed to revoke Android enrollment session")
      );
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <Heading>
            <Trans>Android Provisioning</Trans>
          </Heading>
          <Text className="mt-2 max-w-3xl text-zinc-600 dark:text-zinc-300">
            <Trans>
              Generate short-lived enrollment sessions, display the backend-issued
              provisioning QR code, and revoke unused Android bootstrap sessions.
            </Trans>
          </Text>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(22rem,1fr)]">
        <section className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Heading level={2}>
                <Trans>Enrollment Sessions</Trans>
              </Heading>
              <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                <Trans>
                  Pending sessions stay revocable until the bootstrap token is
                  exchanged, revoked, or expires.
                </Trans>
              </Text>
            </div>
          </div>

          {loadError && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
              {loadError}
            </div>
          )}

          {loading ? (
            <div role="status" aria-live="polite" className="rounded-2xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900/60">
              <Text>
                <Trans>Loading enrollment sessions...</Trans>
              </Text>
            </div>
          ) : sessions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6 dark:border-zinc-700 dark:bg-zinc-900/40">
              <Text className="text-zinc-600 dark:text-zinc-300">
                <Trans>No Android enrollment sessions have been created yet.</Trans>
              </Text>
            </div>
          ) : (
            <Table className="[--gutter:--spacing(5)] lg:[--gutter:--spacing(6)]">
              <TableHead>
                <TableRow>
                  <TableHeader>
                    <Trans>Device</Trans>
                  </TableHeader>
                  <TableHeader>
                    <Trans>Status</Trans>
                  </TableHeader>
                  <TableHeader>
                    <Trans>Channel</Trans>
                  </TableHeader>
                  <TableHeader>
                    <Trans>Expires</Trans>
                  </TableHeader>
                  <TableHeader>
                    <Trans>Actions</Trans>
                  </TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="font-medium">
                          {session.device_label || _(
                            msg`Unnamed Android enrollment session`
                          )}
                        </div>
                        {session.bootstrap_token_last_eight && (
                          <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                            <Trans>Token suffix:</Trans>{" "}
                            {session.bootstrap_token_last_eight}
                          </Text>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge color={getStatusBadgeColor(session.status)}>
                        {session.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{session.update_channel}</TableCell>
                    <TableCell>{formatDateTime(session.bootstrap_token_expires_at)}</TableCell>
                    <TableCell>
                      {capabilities.actions.androidProvisioning.revoke &&
                      session.status === "pending" ? (
                        <Button
                          outline
                          onClick={() => {
                            setSessionToRevoke(session);
                            setRevocationReason("");
                            setRevokeError(null);
                          }}
                        >
                          <Trans>Revoke</Trans>
                        </Button>
                      ) : (
                        <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                          <Trans>No action available</Trans>
                        </Text>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="space-y-6 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
          <div>
            <Heading level={2}>
              <Trans>Create Enrollment Session</Trans>
            </Heading>
            <Text className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              <Trans>
                Each QR code is issued by the backend and tied to a short-lived,
                revocable bootstrap token.
              </Trans>
            </Text>
          </div>

          {capabilities.actions.androidProvisioning.create ? (
            <form className="space-y-4" onSubmit={handleCreateSession}>
              <Field>
                <Label>
                  <Trans>Device label</Trans>
                </Label>
                <Input
                  name="device_label"
                  value={formState.device_label}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      device_label: event.target.value,
                    }))
                  }
                  placeholder={_(msg`Front desk tablet`)}
                />
              </Field>

              <Field>
                <Label>
                  <Trans>Update channel</Trans>
                </Label>
                <Select
                  name="update_channel"
                  value={formState.update_channel}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      update_channel: event.target
                        .value as AndroidReleaseChannel,
                    }))
                  }
                >
                  <option value="managed_device">managed_device</option>
                  <option value="direct_apk">direct_apk</option>
                  <option value="github_release">github_release</option>
                  <option value="obtainium">obtainium</option>
                </Select>
              </Field>

              <Field>
                <Label>
                  <Trans>Revocation and expiry guidance</Trans>
                </Label>
                <Text className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100">
                  <Trans>
                    Revoke unused QR sessions immediately after a device handoff
                    changes. The default bootstrap lifetime is 15 minutes.
                  </Trans>
                </Text>
              </Field>

              <Field>
                <Label>
                  <Trans>Notes</Trans>
                </Label>
                <Textarea
                  name="notes"
                  value={formState.notes}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                  rows={4}
                />
              </Field>

              {submitError && (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                  {submitError}
                </div>
              )}

              <Button type="submit" disabled={creating}>
                {creating ? (
                  <Trans>Creating enrollment session...</Trans>
                ) : (
                  <Trans>Create enrollment session</Trans>
                )}
              </Button>
            </form>
          ) : (
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900/40 dark:text-zinc-300">
              <Trans>
                You can inspect Android enrollment status, but creating or
                revoking sessions requires write permission.
              </Trans>
            </div>
          )}

          {latestProvisioningQrPayload && latestProvisioningSession && (
            <div className="space-y-4 rounded-3xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
              <div>
                <Heading level={3}>
                  <Trans>Provisioning QR code</Trans>
                </Heading>
                <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-300">
                  <Trans>
                    This QR payload was issued by the backend for the latest
                    enrollment session you created.
                  </Trans>
                </Text>
              </div>

              <MfaQrCode
                value={latestProvisioningQrPayload}
                alt={_(msg`Android provisioning QR code`)}
              />

              <div className="grid gap-3 rounded-2xl bg-white/80 p-4 text-sm dark:bg-zinc-950/70 md:grid-cols-2">
                <div>
                  <Text className="font-medium text-zinc-900 dark:text-zinc-50">
                    {latestProvisioningSession.device_label ||
                      _(msg`Unnamed Android enrollment session`)}
                  </Text>
                  <Text className="text-zinc-500 dark:text-zinc-400">
                    {latestProvisioningSession.update_channel}
                  </Text>
                </div>
                <div>
                  <Text className="font-medium text-zinc-900 dark:text-zinc-50">
                    <Trans>Expires</Trans>
                  </Text>
                  <Text className="text-zinc-500 dark:text-zinc-400">
                    {formatDateTime(
                      latestProvisioningSession.bootstrap_token_expires_at
                    )}
                  </Text>
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      <Dialog
        open={sessionToRevoke !== null}
        onClose={(open) => {
          if (!open) {
            setSessionToRevoke(null);
            setRevocationReason("");
            setRevokeError(null);
          }
        }}
      >
        <DialogTitle>
          <Trans>Revoke Android enrollment session</Trans>
        </DialogTitle>
        <DialogDescription>
          <Trans>
            Revoke the selected bootstrap token so the provisioning QR code can
            no longer be exchanged.
          </Trans>
        </DialogDescription>
        <DialogBody>
          <div className="space-y-4">
            {revokeError && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                {revokeError}
              </div>
            )}
            <Field>
              <Label>
                <Trans>Revocation reason</Trans>
              </Label>
              <Textarea
                name="revocation_reason"
                value={revocationReason}
                onChange={(event) => setRevocationReason(event.target.value)}
                rows={4}
              />
            </Field>
          </div>
        </DialogBody>
        <DialogActions>
          <Button
            outline
            onClick={() => {
              setSessionToRevoke(null);
              setRevocationReason("");
              setRevokeError(null);
            }}
          >
            <Trans>Cancel</Trans>
          </Button>
          <Button
            onClick={handleConfirmRevoke}
            disabled={revoking || revocationReason.trim().length === 0}
          >
            {revoking ? <Trans>Revoking...</Trans> : <Trans>Confirm revoke</Trans>}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
