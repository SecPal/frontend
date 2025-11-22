// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect, useRef } from "react";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { Button } from "./button";
import { Dialog, DialogActions, DialogBody, DialogTitle } from "./dialog";
import { createShare, ApiError } from "../services/shareApi";

export interface ShareDialogProps {
  secretId: string;
  secretTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  users: Array<{ id: string; name: string }>;
  roles: Array<{ id: string; name: string }>;
}

export function ShareDialog({
  secretId,
  secretTitle,
  isOpen,
  onClose,
  onSuccess,
  users,
  roles,
}: ShareDialogProps) {
  const { i18n } = useLingui();
  const [selectedId, setSelectedId] = useState<string>("");
  const [permission, setPermission] = useState<"read" | "write" | "admin">(
    "read"
  );
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setSelectedId("");
      setPermission("read");
      setExpiresAt("");
      setError(null);
      // Focus first input
      setTimeout(() => selectRef.current?.focus(), 0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) return;

    setLoading(true);
    setError(null);

    try {
      const isRole = selectedId.startsWith("role-");
      const payload: {
        user_id?: string;
        role_id?: string;
        permission: "read" | "write" | "admin";
        expires_at?: string;
      } = {
        permission,
      };

      if (isRole) {
        payload.role_id = selectedId.replace("role-", "");
      } else {
        payload.user_id = selectedId;
      }

      if (expiresAt) {
        // Convert date to ISO 8601 with end-of-day time in user's local timezone
        const localEndOfDay = new Date(`${expiresAt}T23:59:59`);
        payload.expires_at = localEndOfDay.toISOString();
      }

      await createShare(secretId, payload);
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(i18n._(msg`Failed to share secret`));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onClose={onClose}
      aria-label="Share secret"
      aria-labelledby="share-dialog-title"
      aria-describedby="share-dialog-description"
    >
      <form onSubmit={handleSubmit}>
        <DialogTitle id="share-dialog-title">
          <Trans>Share "{secretTitle}"</Trans>
        </DialogTitle>

        <DialogBody className="space-y-6">
          <div id="share-dialog-description" className="sr-only">
            <Trans>
              Share this secret with users or roles. Select a recipient, choose
              permission level, and optionally set an expiration date.
            </Trans>
          </div>

          {/* Share with selector */}
          <div>
            <label
              htmlFor="share-target"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
            >
              <Trans>Share with:</Trans>
            </label>
            <select
              id="share-target"
              ref={selectRef}
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-md border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              required
            >
              <option value="">{i18n._(msg`Select user or role...`)}</option>
              <optgroup label={i18n._(msg`Users`)}>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label={i18n._(msg`Roles`)}>
                {roles.map((role) => (
                  <option key={role.id} value={`role-${role.id}`}>
                    {role.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Permission dropdown */}
          <div>
            <label
              htmlFor="permission"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
            >
              <Trans>Permission:</Trans>
            </label>
            <select
              id="permission"
              value={permission}
              onChange={(e) =>
                setPermission(e.target.value as "read" | "write" | "admin")
              }
              className="w-full rounded-md border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            >
              <option value="read">
                <Trans>Read</Trans>
              </option>
              <option value="write">
                <Trans>Write</Trans>
              </option>
              <option value="admin">
                <Trans>Admin</Trans>
              </option>
            </select>
          </div>

          {/* Expiration date */}
          <div>
            <label
              htmlFor="expires-at"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
            >
              <Trans>Expires (optional):</Trans>
            </label>
            <input
              id="expires-at"
              type="date"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
              className="w-full rounded-md border-zinc-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
            />
          </div>

          {/* Permission descriptions */}
          <div className="rounded-md bg-zinc-50 dark:bg-zinc-800 p-4 text-sm">
            <p className="font-semibold mb-2">
              <Trans>Permission Levels:</Trans>
            </p>
            <ul className="space-y-1 text-zinc-600 dark:text-zinc-400">
              <li>
                <Trans>• Read: View secret details</Trans>
              </li>
              <li>
                <Trans>• Write: View + edit secret</Trans>
              </li>
              <li>
                <Trans>• Admin: View + edit + share + delete</Trans>
              </li>
            </ul>
          </div>

          {/* Error message */}
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}
        </DialogBody>

        <DialogActions>
          <Button plain onClick={onClose} disabled={loading}>
            <Trans>Cancel</Trans>
          </Button>
          <Button type="submit" disabled={!selectedId || loading}>
            {loading ? <Trans>Sharing...</Trans> : <Trans>Share</Trans>}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
