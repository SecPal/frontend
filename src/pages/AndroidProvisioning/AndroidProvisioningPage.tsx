// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import {
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type FormEvent,
} from "react";
import { Plus, QrCode, RotateCcw } from "lucide-react";
import { apiConfig } from "../../config";
import { MfaQrCode } from "../../components/MfaQrCode";
import { useUserCapabilities } from "../../hooks/useUserCapabilities";
import { formatApiDateTime } from "../../lib/dateUtils";
import { ApiError } from "../../services/ApiError";
import { apiFetch } from "../../services/csrf";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Field,
  FieldLabel,
  Input,
  LoadingRegion,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Skeleton,
  cn,
} from "@/ui";
import {
  ANDROID_RELEASE_CHANNELS,
  type AndroidCreateSessionResponse,
  type AndroidEnrollmentSession,
  type AndroidEnrollmentStatus,
  type AndroidReleaseChannel,
  type AndroidSessionListResponse,
  type ApiEnvelope,
} from "../../types/api/android-enrollment";

const CHANNELS = ANDROID_RELEASE_CHANNELS;

type CreateFormState = {
  device_label: string;
  update_channel: AndroidReleaseChannel;
};

const INITIAL_FORM: CreateFormState = {
  device_label: "",
  update_channel: "managed_device",
};

const DEFAULT_PROVISIONING_PROFILE = {
  kiosk_mode_enabled: true,
  lock_task_enabled: true,
  allow_phone: false,
  allow_sms: false,
  prefer_gesture_navigation: true,
  allowed_packages: ["app.secpal"],
};

function formatDateTime(value: string | null): string {
  return formatApiDateTime(value, {
    fallback: "-",
    formatOptions: {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    },
  });
}

function getStatusBadgeClass(status: AndroidEnrollmentStatus) {
  switch (status) {
    case "pending":
      return "bg-sky-500/15 text-foreground dark:bg-sky-500/10";
    case "exchanged":
      return "bg-lime-400/20 text-foreground dark:bg-lime-400/10";
    case "revoked":
      return "bg-rose-400/15 text-foreground dark:bg-rose-400/10";
    case "expired":
      return "bg-amber-400/20 text-foreground dark:bg-amber-400/10";
  }
}

function MutedText({ className, ...props }: ComponentPropsWithoutRef<"p">) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

function EnrollmentSessionSkeletonList({
  loadingLabel,
}: {
  loadingLabel: string;
}) {
  return (
    <div
      role="status"
      aria-busy="true"
      aria-label={loadingLabel}
      aria-live="polite"
      className="space-y-3"
    >
      <span className="sr-only">{loadingLabel}</span>
      {Array.from({ length: 3 }, (_, index) => (
        <div
          key={index}
          className="rounded-md border border-border bg-card p-4"
          aria-hidden="true"
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex-1 space-y-3">
              <Skeleton className="h-4 w-48 max-w-full" />
              <div className="flex flex-wrap items-center gap-2">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-40" />
              </div>
              <Skeleton className="h-4 w-80 max-w-full" />
            </div>
            <Skeleton className="h-10 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

function getChannelLabel(
  channel: AndroidReleaseChannel,
  translate: ReturnType<typeof useLingui>["_"]
): string {
  switch (channel) {
    case "managed_device":
      return translate(msg`Managed device rollout`);
    case "direct_apk":
      return translate(msg`Direct APK sideload`);
    case "github_release":
      return translate(msg`GitHub Releases`);
    case "obtainium":
      return translate(msg`Obtainium`);
    default: {
      const unknownChannel = channel as string;
      return `${translate(msg`Unknown channel`)} (${unknownChannel})`;
    }
  }
}

function getStatusLabel(
  status: AndroidEnrollmentStatus,
  translate: ReturnType<typeof useLingui>["_"]
): string {
  switch (status) {
    case "pending":
      return translate(msg`Ready for setup`);
    case "exchanged":
      return translate(msg`Bootstrap completed`);
    case "revoked":
      return translate(msg`Revoked`);
    case "expired":
      return translate(msg`Expired`);
    default: {
      const unknownStatus = status as string;
      return `${translate(msg`Unknown status`)} (${unknownStatus})`;
    }
  }
}

function getStatusGuidance(
  status: AndroidEnrollmentStatus,
  translate: ReturnType<typeof useLingui>["_"]
): string {
  switch (status) {
    case "pending":
      return translate(
        msg`Use this QR code during Android setup before it expires.`
      );
    case "exchanged":
      return translate(
        msg`This session has already been used to complete device bootstrap.`
      );
    case "revoked":
      return translate(
        msg`This session was revoked and can no longer be used for device setup.`
      );
    case "expired":
      return translate(
        msg`This session expired before setup completed. Create a new session to continue.`
      );
    default:
      return "";
  }
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError || error instanceof Error) {
    return error.message;
  }

  return fallback;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const { headers: initHeaders, ...requestInit } = init ?? {};
  const headers = new Headers(initHeaders as HeadersInit | undefined);
  headers.set("Accept", "application/json");
  const response = await apiFetch(`${apiConfig.baseUrl}${path}`, {
    ...requestInit,
    headers,
  });

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({ message: response.statusText }))) as {
      errors?: Record<string, string[]>;
      message?: string;
    };

    throw new ApiError(
      payload.message ||
        response.statusText ||
        "Android provisioning request failed",
      response.status,
      payload.errors,
      response
    );
  }

  return (await response.json()) as T;
}

export default function AndroidProvisioningPage() {
  const { _ } = useLingui();
  const capabilities = useUserCapabilities();
  const [formState, setFormState] = useState(INITIAL_FORM);
  const [sessions, setSessions] = useState<AndroidEnrollmentSession[]>([]);
  const [latestQrPayload, setLatestQrPayload] = useState<string | null>(null);
  const [latestSession, setLatestSession] =
    useState<AndroidEnrollmentSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const canCreate = capabilities.actions.androidProvisioning.create;
  const canRevoke = capabilities.actions.androidProvisioning.revoke;
  const sessionsLoadingLabel = _(msg`Loading enrollment sessions...`);

  useEffect(() => {
    let active = true;

    void requestJson<AndroidSessionListResponse>(
      "/v1/android-enrollment-sessions?per_page=15"
    )
      .then((response) => {
        if (!active) {
          return;
        }

        setSessions(response.data);
        setLoadError(null);
      })
      .catch((error) => {
        if (!active) {
          return;
        }

        setLoadError(
          getErrorMessage(error, "Failed to load Android enrollment sessions")
        );
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setSubmitError(null);

    try {
      const response = await requestJson<AndroidCreateSessionResponse>(
        "/v1/android-enrollment-sessions",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            device_label: formState.device_label.trim() || undefined,
            provisioning_profile: DEFAULT_PROVISIONING_PROFILE,
            update_channel: formState.update_channel,
          }),
        }
      );

      setSessions((current) => [
        response.data.session,
        ...current.filter((session) => session.id !== response.data.session.id),
      ]);
      setLatestQrPayload(JSON.stringify(response.data.provisioning_qr_payload));
      setLatestSession(response.data.session);
      setFormState(INITIAL_FORM);
    } catch (error) {
      setSubmitError(
        getErrorMessage(error, "Failed to create Android enrollment session")
      );
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(session: AndroidEnrollmentSession) {
    const reason = window.prompt(_(msg`Revocation reason`), "");

    if (!reason || reason.trim().length === 0) {
      return;
    }

    try {
      const response = await requestJson<ApiEnvelope<AndroidEnrollmentSession>>(
        `/v1/android-enrollment-sessions/${session.id}/revoke`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason: reason.trim() }),
        }
      );

      setSessions((current) =>
        current.map((entry) =>
          entry.id === response.data.id ? response.data : entry
        )
      );
      setLatestSession((current) =>
        current?.id === response.data.id ? response.data : current
      );
      setLoadError(null);
    } catch (error) {
      setLoadError(
        getErrorMessage(error, "Failed to revoke Android enrollment session")
      );
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-foreground text-2xl font-semibold tracking-normal">
        <Trans>Android Provisioning</Trans>
      </h1>

      {loadError ? (
        <Alert className="border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            {loadError}
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-4 p-6">
            {canCreate ? (
              <form className="space-y-4" onSubmit={handleCreateSession}>
                <Field>
                  <FieldLabel htmlFor="android-device-label">
                    <Trans>Device label</Trans>
                  </FieldLabel>
                  <Input
                    id="android-device-label"
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
                  <FieldLabel htmlFor="android-update-channel">
                    <Trans>Update channel</Trans>
                  </FieldLabel>
                  <Select
                    name="update_channel"
                    value={formState.update_channel}
                    onValueChange={(value) =>
                      setFormState((current) => ({
                        ...current,
                        update_channel: value as AndroidReleaseChannel,
                      }))
                    }
                  >
                    <SelectTrigger
                      id="android-update-channel"
                      aria-label={_(msg`Update channel`)}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CHANNELS.map((channel) => (
                        <SelectItem
                          key={channel}
                          value={channel}
                          data-value={channel}
                        >
                          {getChannelLabel(channel, _)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>

                {submitError ? (
                  <Alert className="border-destructive/30 bg-destructive/10 text-foreground">
                    <AlertDescription className="text-destructive">
                      {submitError}
                    </AlertDescription>
                  </Alert>
                ) : null}

                <Button type="submit" disabled={creating}>
                  <Plus className="size-4" aria-hidden="true" />
                  {creating ? (
                    <Trans>Creating enrollment session...</Trans>
                  ) : (
                    <Trans>Create enrollment session</Trans>
                  )}
                </Button>
              </form>
            ) : (
              <MutedText>
                <Trans>
                  You can inspect Android enrollment status, but write
                  permission is required to create or revoke sessions.
                </Trans>
              </MutedText>
            )}

            {latestQrPayload && latestSession ? (
              <div className="space-y-3 rounded-md border border-border bg-muted p-5">
                <h2 className="text-foreground flex items-center gap-2 text-base font-semibold tracking-normal">
                  <QrCode className="size-4" aria-hidden="true" />
                  <Trans>Provisioning QR code</Trans>
                </h2>
                <MfaQrCode
                  value={latestQrPayload}
                  alt={_(msg`Android provisioning QR code`)}
                />
                <p className="text-foreground text-sm font-medium">
                  {latestSession.device_label ||
                    _(msg`Unnamed Android enrollment session`)}
                </p>
                <MutedText>
                  {getChannelLabel(latestSession.update_channel, _)}
                </MutedText>
                <MutedText>
                  <Trans>Expires</Trans>:{" "}
                  {formatDateTime(latestSession.bootstrap_token_expires_at)}
                </MutedText>
                <MutedText>
                  {getStatusGuidance(latestSession.status, _)}
                </MutedText>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <Trans>Enrollment Sessions</Trans>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading && sessions.length === 0 ? (
              <EnrollmentSessionSkeletonList
                loadingLabel={sessionsLoadingLabel}
              />
            ) : null}
            {!loading && sessions.length === 0 ? (
              <MutedText>
                <Trans>
                  No Android enrollment sessions have been created yet.
                </Trans>
              </MutedText>
            ) : null}

            {sessions.length > 0 ? (
              <LoadingRegion
                loading={loading}
                loadingLabel={sessionsLoadingLabel}
              >
                <div className="space-y-3">
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      className="flex flex-col gap-3 rounded-md border border-border bg-card p-4 md:flex-row md:items-center md:justify-between"
                    >
                      <div className="space-y-1">
                        <p className="text-foreground text-sm font-medium">
                          {session.device_label ||
                            _(msg`Unnamed Android enrollment session`)}
                        </p>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge
                            className={getStatusBadgeClass(session.status)}
                          >
                            {getStatusLabel(session.status, _)}
                          </Badge>
                          <MutedText>
                            {getChannelLabel(session.update_channel, _)}
                          </MutedText>
                          <MutedText>
                            <Trans>Expires</Trans>:{" "}
                            {formatDateTime(session.bootstrap_token_expires_at)}
                          </MutedText>
                        </div>
                        <MutedText>
                          {getStatusGuidance(session.status, _)}
                        </MutedText>
                        {session.revocation_reason ? (
                          <MutedText>
                            <Trans>Reason</Trans>: {session.revocation_reason}
                          </MutedText>
                        ) : null}
                      </div>

                      {canRevoke && session.status === "pending" ? (
                        <Button
                          variant="outline"
                          onClick={() => void handleRevoke(session)}
                        >
                          <RotateCcw className="size-4" aria-hidden="true" />
                          <Trans>Revoke</Trans>
                        </Button>
                      ) : (
                        <MutedText>
                          {session.revoked_at ? (
                            <Trans>Revoked</Trans>
                          ) : (
                            <Trans>No action available</Trans>
                          )}
                        </MutedText>
                      )}
                    </div>
                  ))}
                </div>
              </LoadingRegion>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
