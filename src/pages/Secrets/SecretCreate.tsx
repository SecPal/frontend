// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trans, t } from "@lingui/macro";
import { SecretForm, SecretFormData } from "../../components/SecretForm";
import { createSecret, ApiError } from "../../services/secretApi";
import { formatValidationErrors } from "../../lib/errorUtils";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";

/**
 * Page for creating a new secret
 */
export function SecretCreate() {
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const handleSubmit = async (data: SecretFormData) => {
    setIsSubmitting(true);
    setError("");

    try {
      const newSecret = await createSecret({
        title: data.title,
        username: data.username || undefined,
        password: data.password || undefined,
        url: data.url || undefined,
        notes: data.notes || undefined,
        tags: data.tags.length > 0 ? data.tags : undefined,
        expires_at: data.expires_at || undefined,
      });

      // Navigate to detail page on success
      navigate(`/secrets/${newSecret.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422 && err.errors) {
          const errorMessages = Object.entries(err.errors)
            .map(([field, messages]) => `${field}: ${messages.join(", ")}`)
            .join("; ");
          setError(errorMessages);
        } else {
          setError(err.message);
        }
      } else {
        const validationError = formatValidationErrors(err);
        setError(validationError || "An unexpected error occurred");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    navigate("/secrets");
  };

  return (
    <>
      <div className="mb-8">
        <Heading>
          <Trans>Create Secret</Trans>
        </Heading>
        <Text className="mt-2">
          <Trans>Add a new secret to your vault.</Trans>
        </Text>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <SecretForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel={t`Create`}
          isSubmitting={isSubmitting}
          error={error}
        />
      </div>
    </>
  );
}
