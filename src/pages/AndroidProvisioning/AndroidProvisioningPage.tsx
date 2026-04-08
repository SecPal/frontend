// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { msg, Trans } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { useEffect, useState, type FormEvent } from "react";
import { apiConfig } from "../../config";
import { Badge } from "../../components/badge";
import { Button } from "../../components/button";
import { Field, Label } from "../../components/fieldset";
import { Heading } from "../../components/heading";
import { Input } from "../../components/input";
import { MfaQrCode } from "../../components/MfaQrCode";
import { Select } from "../../components/select";
import { Text } from "../../components/text";
import { useUserCapabilities } from "../../hooks/useUserCapabilities";
import { ApiError } from "../../services/ApiError";
import { apiFetch } from "../../services/csrf";
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
  return value ? new Date(value).toLocaleString() : "-";
}

function getStatusColor(status: AndroidEnrollmentStatus) {
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

  async function loadSessions() {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await requestJson<AndroidSessionListResponse>(
        "/v1/admin/android-enrollment-sessions?per_page=15"
      );
      setSessions(response.data);
    } catch (error) {
      setLoadError(
        getErrorMessage(error, "Failed to load Android enrollment sessions")
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadSessions();
  }, []);

  async function handleCreateSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreating(true);
    setSubmitError(null);

    try {
      const response = await requestJson<AndroidCreateSessionResponse>(
        "/v1/admin/android-enrollment-sessions",
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
        `/v1/admin/android-enrollment-sessions/${session.id}/revoke`,
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
      <Heading>
        <Trans>Android Provisioning</Trans>
      </Heading>

      {loadError ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
          {loadError}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)]">
        <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          {canCreate ? (
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
                  {CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {getChannelLabel(channel, _)}
                    </option>
                  ))}
                </Select>
              </Field>

              {submitError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                  {submitError}
                </div>
              ) : null}

              <Button type="submit" disabled={creating}>
                {creating ? (
                  <Trans>Creating enrollment session...</Trans>
                ) : (
                  <Trans>Create enrollment session</Trans>
                )}
              </Button>
            </form>
          ) : (
            <Text>
              <Trans>
                You can inspect Android enrollment status, but write permission
                is required to create or revoke sessions.
              </Trans>
            </Text>
          )}

          {latestQrPayload && latestSession ? (
            <div className="space-y-3 rounded-3xl border border-sky-200 bg-sky-50 p-5 dark:border-sky-900/60 dark:bg-sky-950/30">
              <Heading level={3}>
                <Trans>Provisioning QR code</Trans>
              </Heading>
              <MfaQrCode
                value={latestQrPayload}
                alt={_(msg`Android provisioning QR code`)}
              />
              <Text>
                {latestSession.device_label ||
                  _(msg`Unnamed Android enrollment session`)}
              </Text>
              <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                {getChannelLabel(latestSession.update_channel, _)}
              </Text>
              <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                <Trans>Expires</Trans>:{" "}
                {formatDateTime(latestSession.bootstrap_token_expires_at)}
              </Text>
              <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                {getStatusGuidance(latestSession.status, _)}
              </Text>
            </div>
          ) : null}
        </section>

        <section className="space-y-4 rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
          <Heading level={2}>
            <Trans>Enrollment Sessions</Trans>
          </Heading>

          {loading ? (
            <Text>
              <Trans>Loading enrollment sessions...</Trans>
            </Text>
          ) : null}
          {!loading && sessions.length === 0 ? (
            <Text>
              <Trans>
                No Android enrollment sessions have been created yet.
              </Trans>
            </Text>
          ) : null}

          {!loading ? (
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800 md:flex-row md:items-center md:justify-between"
                >
                  <div className="space-y-1">
                    <Text className="font-medium text-zinc-950 dark:text-zinc-50">
                      {session.device_label ||
                        _(msg`Unnamed Android enrollment session`)}
                    </Text>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge color={getStatusColor(session.status)}>
                        {getStatusLabel(session.status, _)}
                      </Badge>
                      <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                        {getChannelLabel(session.update_channel, _)}
                      </Text>
                      <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                        <Trans>Expires</Trans>:{" "}
                        {formatDateTime(session.bootstrap_token_expires_at)}
                      </Text>
                    </div>
                    <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                      {getStatusGuidance(session.status, _)}
                    </Text>
                    {session.revocation_reason ? (
                      <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                        <Trans>Reason</Trans>: {session.revocation_reason}
                      </Text>
                    ) : null}
                  </div>

                  {canRevoke && session.status === "pending" ? (
                    <Button outline onClick={() => void handleRevoke(session)}>
                      <Trans>Revoke</Trans>
                    </Button>
                  ) : (
                    <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                      {session.revoked_at ? (
                        <Trans>Revoked</Trans>
                      ) : (
                        <Trans>No action available</Trans>
                      )}
                    </Text>
                  )}
                </div>
              ))}
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
