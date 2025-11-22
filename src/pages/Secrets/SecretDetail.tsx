// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import {
  getSecretById,
  ApiError,
  getSecretMasterKey,
  downloadAndDecryptAttachment,
  deleteAttachment,
  type SecretDetail as SecretDetailType,
} from "../../services/secretApi";
import { fetchShares } from "../../services/shareApi";
import { AttachmentList } from "../../components/AttachmentList";
import { AttachmentPreview } from "../../components/AttachmentPreview";
import { ShareDialog } from "../../components/ShareDialog";
import { SharedWithList } from "../../components/SharedWithList";

/**
 * Helper function to trigger browser download
 * Creates a temporary link element, clicks it, and cleans up
 */
function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Secret Detail Page
 *
 * Displays full details of a secret including password (with show/hide toggle),
 * attachments, shares, and metadata
 */
export function SecretDetail() {
  const { id } = useParams<{ id: string }>();
  const { i18n } = useLingui();
  const [secret, setSecret] = useState<SecretDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [masterKey, setMasterKey] = useState<CryptoKey | null>(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [previewFile, setPreviewFile] = useState<{
    file: File;
    url: string;
  } | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shares, setShares] = useState(secret?.shares || []);

  // Cleanup blob URL when previewFile changes or component unmounts
  useEffect(() => {
    return () => {
      if (previewFile) {
        URL.revokeObjectURL(previewFile.url);
      }
    };
  }, [previewFile]);

  useEffect(() => {
    const loadSecret = async () => {
      if (!id) {
        setError("Invalid secret ID");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await getSecretById(id);
        setSecret(data);
        setShares(data.shares || []);

        // Load master key if secret has attachments
        if (data.attachments && data.attachments.length > 0) {
          try {
            const key = await getSecretMasterKey(id);
            setMasterKey(key);
          } catch (keyErr) {
            console.error("Failed to load master key:", keyErr);
            // Non-fatal - user can still view secret details
          }
        }
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 404) {
            setError("Secret not found");
          } else if (err.status === 403) {
            setError("You do not have permission to view this secret");
          } else {
            setError(err.message);
          }
        } else {
          setError("Failed to load secret");
        }
      } finally {
        setLoading(false);
      }
    };

    loadSecret();
  }, [id]);

  /**
   * Handle attachment download
   */
  const handleDownload = async (
    attachmentId: string,
    key: CryptoKey
  ): Promise<void> => {
    try {
      setAttachmentLoading(true);
      const file = await downloadAndDecryptAttachment(attachmentId, key);

      // Trigger browser download
      const url = URL.createObjectURL(file);
      try {
        triggerDownload(url, file.name);
      } finally {
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error("Download failed:", err);
      alert(i18n._(msg`Failed to download attachment`));
    } finally {
      setAttachmentLoading(false);
    }
  };

  /**
   * Handle attachment delete
   */
  const handleDelete = async (attachmentId: string): Promise<void> => {
    if (
      !confirm(i18n._(msg`Are you sure you want to delete this attachment?`))
    ) {
      return;
    }

    try {
      setAttachmentLoading(true);
      await deleteAttachment(attachmentId);

      // Refresh secret to update attachment list
      if (id) {
        const updatedSecret = await getSecretById(id);
        setSecret(updatedSecret);
      }
    } catch (err) {
      console.error("Delete failed:", err);
      alert(i18n._(msg`Failed to delete attachment`));
    } finally {
      setAttachmentLoading(false);
    }
  };

  /**
   * Handle attachment preview
   */
  const handlePreview = async (
    attachmentId: string,
    key: CryptoKey
  ): Promise<void> => {
    try {
      setAttachmentLoading(true);
      const file = await downloadAndDecryptAttachment(attachmentId, key);
      const url = URL.createObjectURL(file);
      setPreviewFile({ file, url });
    } catch (err) {
      console.error("Preview failed:", err);
      alert(i18n._(msg`Failed to load preview`));
    } finally {
      setAttachmentLoading(false);
    }
  };

  /**
   * Close preview modal
   */
  const handleClosePreview = () => {
    if (previewFile) {
      URL.revokeObjectURL(previewFile.url);
      setPreviewFile(null);
    }
  };

  /**
   * Refresh shares list after create/revoke
   */
  const refreshShares = async () => {
    if (!id) return;
    try {
      const updatedShares = await fetchShares(id);
      setShares(updatedShares);
    } catch (err) {
      console.error("Failed to refresh shares:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-4xl">🔄</div>
          <p className="text-zinc-600 dark:text-zinc-400">Loading secret...</p>
        </div>
      </div>
    );
  }

  if (error || !secret) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-900/20">
          <div className="mb-4 text-4xl">❌</div>
          <h2 className="mb-2 text-lg font-semibold text-red-900 dark:text-red-400">
            Error Loading Secret
          </h2>
          <p className="mb-4 text-sm text-red-700 dark:text-red-500">
            {error || "Secret not found"}
          </p>
          <Link
            to="/secrets"
            className="inline-block rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
          >
            Back to Secrets
          </Link>
        </div>
      </div>
    );
  }

  const isExpired =
    secret.expires_at && new Date(secret.expires_at) < new Date();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-4">
            <Link
              to="/secrets"
              className="inline-flex items-center gap-2 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
            >
              <span>&lt;</span> Back
            </Link>
          </div>
          <div className="flex items-start justify-between">
            <h1 className="text-3xl font-bold text-zinc-900 dark:text-white">
              {secret.title}
            </h1>
            {isExpired && (
              <span className="inline-flex items-center rounded-md bg-red-50 px-3 py-1 text-sm font-medium text-red-700 ring-1 ring-inset ring-red-600/20 dark:bg-red-900/30 dark:text-red-400 dark:ring-red-900/30">
                ⚠️ Expired
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="grid gap-4">
              {/* Username */}
              {secret.username && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Username
                  </label>
                  <p className="mt-1 text-base text-zinc-900 dark:text-white">
                    {secret.username}
                  </p>
                </div>
              )}

              {/* Password */}
              {secret.password && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Password
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-base text-zinc-900 dark:text-white">
                      {showPassword ? secret.password : "••••••••••••"}
                    </p>
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="rounded-md border border-zinc-300 bg-white px-3 py-1 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                </div>
              )}

              {/* URL */}
              {secret.url && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    URL
                  </label>
                  <a
                    href={secret.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block text-base text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                  >
                    {secret.url}
                  </a>
                </div>
              )}

              {/* Tags */}
              {secret.tags && secret.tags.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Tags
                  </label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {secret.tags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center rounded-md bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-700 ring-1 ring-inset ring-zinc-600/20 dark:bg-zinc-800/50 dark:text-zinc-400 dark:ring-zinc-700/50"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Expiration */}
              {secret.expires_at && (
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Expires
                  </label>
                  <p
                    className={`mt-1 text-base ${
                      isExpired
                        ? "font-semibold text-red-600 dark:text-red-400"
                        : "text-zinc-900 dark:text-white"
                    }`}
                  >
                    {new Date(secret.expires_at).toLocaleString()}
                    {isExpired && " (Expired)"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Notes */}
          {secret.notes && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-2 text-lg font-semibold text-zinc-900 dark:text-white">
                Notes
              </h2>
              <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
                {secret.notes}
              </p>
            </div>
          )}

          {/* Attachments */}
          {secret.attachments && secret.attachments.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
                Attachments ({secret.attachments.length})
              </h2>
              {masterKey ? (
                <AttachmentList
                  attachments={secret.attachments}
                  masterKey={masterKey}
                  onDownload={handleDownload}
                  onDelete={handleDelete}
                  onPreview={handlePreview}
                  isLoading={attachmentLoading}
                />
              ) : (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  <p className="text-sm">
                    ⚠️ Unable to load encryption key for attachments. Please
                    refresh the page or contact support if the problem persists.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Shared With */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Access Control
              </h2>
              {secret.owner != null && (
                <button
                  onClick={() => setShareDialogOpen(true)}
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-700 dark:hover:bg-blue-800"
                >
                  Share
                </button>
              )}
            </div>
            {id && (
              <SharedWithList
                secretId={id}
                shares={shares}
                onRevoke={refreshShares}
              />
            )}
          </div>

          {/* Metadata */}
          <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="grid gap-2 text-sm">
              {secret.owner != null && (
                <p className="text-zinc-600 dark:text-zinc-400">
                  <span className="font-medium">Owner:</span>{" "}
                  {secret.owner.name}
                </p>
              )}
              <p className="text-zinc-600 dark:text-zinc-400">
                <span className="font-medium">Created:</span>{" "}
                {new Date(secret.created_at).toLocaleString()}
              </p>
              <p className="text-zinc-600 dark:text-zinc-400">
                <span className="font-medium">Updated:</span>{" "}
                {new Date(secret.updated_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Attachment Preview Modal */}
      {previewFile && (
        <AttachmentPreview
          file={previewFile.file}
          fileUrl={previewFile.url}
          onClose={handleClosePreview}
          onDownload={() => {
            triggerDownload(previewFile.url, previewFile.file.name);
          }}
        />
      )}

      {/* Share Dialog */}
      {secret && (
        <ShareDialog
          secretId={id!}
          secretTitle={secret.title}
          isOpen={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          onSuccess={refreshShares}
          users={[]}
          roles={[]}
        />
      )}
    </div>
  );
}
