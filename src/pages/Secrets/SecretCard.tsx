// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { Link } from "react-router";
import type { Secret } from "../../services/secretApi";

// Expiring soon threshold (shared constant)
const EXPIRING_SOON_DAYS = 7;
const EXPIRING_SOON_MS = EXPIRING_SOON_DAYS * 24 * 60 * 60 * 1000;

export interface SecretCardProps {
  secret: Secret;
}

/**
 * Card component displaying secret summary in list view
 *
 * Shows title, username, tags, expiration status, attachment count, and share indicator
 */
export function SecretCard({ secret }: SecretCardProps) {
  const now = new Date();
  const expires = secret.expires_at ? new Date(secret.expires_at) : null;

  const isExpired = expires && expires < now;
  const isExpiringSoon =
    !isExpired &&
    expires &&
    expires < new Date(now.getTime() + EXPIRING_SOON_MS);

  return (
    <Link
      to={`/secrets/${secret.id}`}
      className="block rounded-lg border border-zinc-950/10 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-zinc-900"
    >
      {/* Header with title and status badges */}
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
          🔒 {secret.title}
        </h3>
        <div className="flex gap-1">
          {isExpired && (
            <span className="inline-flex items-center rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-900/30">
              Expired
            </span>
          )}
          {isExpiringSoon && (
            <span className="inline-flex items-center rounded-md bg-yellow-50 px-2 py-1 text-xs font-medium text-yellow-700 ring-1 ring-inset ring-yellow-600/20 dark:bg-yellow-900/30 dark:text-yellow-400 dark:ring-yellow-900/30">
              Expiring Soon
            </span>
          )}
        </div>
      </div>
      {/* Username */}
      {secret.username && (
        <p className="mb-2 text-sm text-zinc-600 dark:text-zinc-400">
          {secret.username}
        </p>
      )}
      {/* Tags */}
      {secret.tags && secret.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {secret.tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center rounded-md bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-600/20 dark:bg-zinc-800/50 dark:text-zinc-400 dark:ring-zinc-700/50"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}
      {/* Footer with metadata */}
      <div className="mt-3 flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-500">
        {secret.attachment_count !== undefined &&
          secret.attachment_count > 0 && (
            <span className="flex items-center gap-1">
              <span aria-label="Attachments">📎</span>
              {secret.attachment_count}
            </span>
          )}
        {secret.is_shared && (
          <span className="flex items-center gap-1">
            <span aria-label="Shared">👥</span>
            Shared
          </span>
        )}
      </div>
    </Link>
  );
}
