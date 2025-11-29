// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { msg, Trans, t } from "@lingui/macro";
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
import { Heading, Subheading } from "../../components/heading";
import { Text } from "../../components/text";
import { Button } from "../../components/button";
import { Badge } from "../../components/badge";
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from "../../components/description-list";
import { Divider } from "../../components/divider";

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
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="mb-4 text-4xl">🔄</div>
          <Text>
            <Trans>Loading secret...</Trans>
          </Text>
        </div>
      </div>
    );
  }

  if (error || !secret) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="max-w-md rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-900/20">
          <div className="mb-4 text-4xl">❌</div>
          <Heading level={3} className="text-red-900 dark:text-red-400">
            <Trans>Error Loading Secret</Trans>
          </Heading>
          <Text className="mt-2 text-red-700 dark:text-red-500">
            {error || "Secret not found"}
          </Text>
          <div className="mt-4">
            <Button href="/secrets" color="red">
              <Trans>Back to Secrets</Trans>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const isExpired =
    secret.expires_at && new Date(secret.expires_at) < new Date();

  return (
    <>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-2">
            <Button href="/secrets" plain>
              <Trans>← Back to Secrets</Trans>
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <Heading>{secret.title}</Heading>
            {isExpired && (
              <Badge color="red">
                <Trans>Expired</Trans>
              </Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button href={`/secrets/${id}/edit`} outline>
            <Trans>Edit</Trans>
          </Button>
          {secret.owner != null && (
            <Button onClick={() => setShareDialogOpen(true)}>
              <Trans>Share</Trans>
            </Button>
          )}
        </div>
      </div>

      <Divider className="my-8" />

      {/* Content */}
      <div className="space-y-8">
        {/* Basic Information */}
        <section>
          <Subheading>
            <Trans>Details</Trans>
          </Subheading>
          <DescriptionList className="mt-4">
            {secret.username && (
              <>
                <DescriptionTerm>
                  <Trans>Username</Trans>
                </DescriptionTerm>
                <DescriptionDetails>{secret.username}</DescriptionDetails>
              </>
            )}

            {secret.password && (
              <>
                <DescriptionTerm>
                  <Trans>Password</Trans>
                </DescriptionTerm>
                <DescriptionDetails>
                  <div className="flex items-center gap-2">
                    <code className="font-mono">
                      {showPassword ? secret.password : "••••••••••••"}
                    </code>
                    <Button
                      plain
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={
                        showPassword ? "Hide password" : "Show password"
                      }
                    >
                      {showPassword ? <Trans>Hide</Trans> : <Trans>Show</Trans>}
                    </Button>
                  </div>
                </DescriptionDetails>
              </>
            )}

            {secret.url && (
              <>
                <DescriptionTerm>
                  <Trans>URL</Trans>
                </DescriptionTerm>
                <DescriptionDetails>
                  <a
                    href={secret.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                  >
                    {secret.url}
                  </a>
                </DescriptionDetails>
              </>
            )}

            {secret.tags && secret.tags.length > 0 && (
              <>
                <DescriptionTerm>
                  <Trans>Tags</Trans>
                </DescriptionTerm>
                <DescriptionDetails>
                  <div className="flex flex-wrap gap-1">
                    {secret.tags.map((tag) => (
                      <Badge key={tag} color="zinc">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                </DescriptionDetails>
              </>
            )}

            {secret.expires_at && (
              <>
                <DescriptionTerm>
                  <Trans>Expires</Trans>
                </DescriptionTerm>
                <DescriptionDetails>
                  <span
                    className={
                      isExpired ? "text-red-600 dark:text-red-400" : ""
                    }
                  >
                    {new Date(secret.expires_at).toLocaleString()}
                    {isExpired && ` (${t`Expired`})`}
                  </span>
                </DescriptionDetails>
              </>
            )}
          </DescriptionList>
        </section>

        {/* Notes */}
        {secret.notes && (
          <section>
            <Subheading>
              <Trans>Notes</Trans>
            </Subheading>
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <Text className="whitespace-pre-wrap">{secret.notes}</Text>
            </div>
          </section>
        )}

        {/* Attachments */}
        {secret.attachments && secret.attachments.length > 0 && (
          <section>
            <Subheading>
              <Trans>Attachments ({secret.attachments.length})</Trans>
            </Subheading>
            <div className="mt-4">
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
                  <Text>
                    ⚠️{" "}
                    <Trans>
                      Unable to load encryption key for attachments. Please
                      refresh the page or contact support if the problem
                      persists.
                    </Trans>
                  </Text>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Shared With */}
        <section>
          <Subheading>
            <Trans>Access Control</Trans>
          </Subheading>
          {id && (
            <div className="mt-4">
              <SharedWithList
                secretId={id}
                shares={shares}
                onRevoke={refreshShares}
              />
            </div>
          )}
        </section>

        <Divider />

        {/* Metadata */}
        <section>
          <Subheading>
            <Trans>Metadata</Trans>
          </Subheading>
          <DescriptionList className="mt-4">
            {secret.owner != null && (
              <>
                <DescriptionTerm>
                  <Trans>Owner</Trans>
                </DescriptionTerm>
                <DescriptionDetails>{secret.owner.name}</DescriptionDetails>
              </>
            )}
            <DescriptionTerm>
              <Trans>Created</Trans>
            </DescriptionTerm>
            <DescriptionDetails>
              {new Date(secret.created_at).toLocaleString()}
            </DescriptionDetails>
            <DescriptionTerm>
              <Trans>Updated</Trans>
            </DescriptionTerm>
            <DescriptionDetails>
              {new Date(secret.updated_at).toLocaleString()}
            </DescriptionDetails>
          </DescriptionList>
        </section>
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
    </>
  );
}
