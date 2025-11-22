// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { Button } from "./button";
import { revokeShare, ApiError } from "../services/shareApi";
import type { SecretShare } from "../services/secretApi";

export interface SharedWithListProps {
  secretId: string;
  shares: SecretShare[];
  onRevoke: () => void;
}

export function SharedWithList({
  secretId,
  shares,
  onRevoke,
}: SharedWithListProps) {
  const { i18n } = useLingui();
  const [error, setError] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);

  const handleRevoke = async (share: SecretShare) => {
    const name = share.user?.name || share.role?.name || "this user";
    const confirmed = confirm(
      i18n._(msg`Are you sure you want to revoke access for ${name}?`)
    );

    if (!confirmed) return;

    setRevoking(share.id);
    setError(null);

    try {
      await revokeShare(secretId, share.id);
      onRevoke();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(i18n._(msg`Failed to revoke access`));
      }
    } finally {
      setRevoking(null);
    }
  };

  const formatDate = (isoDate: string) => {
    return new Date(isoDate).toLocaleDateString();
  };

  if (shares.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 text-center text-zinc-500 dark:text-zinc-400">
        <Trans>Not shared with anyone</Trans>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
        <Trans>Shared with ({shares.length})</Trans>
      </h2>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-3 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}

      <ul className="space-y-3">
        {shares.map((share) => {
          const isUser = !!share.user;
          const name = share.user?.name || share.role?.name || "Unknown";
          const icon = isUser ? "👤" : "👥";

          return (
            <li
              key={share.id}
              className="flex items-start justify-between rounded-md border border-zinc-200 p-3 dark:border-zinc-700"
            >
              <div className="flex-1">
                <p className="font-medium text-zinc-900 dark:text-white">
                  <span className="mr-2">{icon}</span>
                  {name} ({share.permission})
                </p>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  <Trans>
                    Granted by {share.granted_by.name} on{" "}
                    {formatDate(share.granted_at)}
                  </Trans>
                </p>
                {share.expires_at && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    <Trans>Expires: {formatDate(share.expires_at)}</Trans>
                  </p>
                )}
              </div>

              <Button
                plain
                onClick={() => handleRevoke(share)}
                disabled={revoking === share.id}
                className="ml-4"
              >
                {revoking === share.id ? (
                  <Trans>Revoking...</Trans>
                ) : (
                  <Trans>Revoke</Trans>
                )}
              </Button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
