// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Trans, t } from "@lingui/macro";
import { SecretForm, SecretFormData } from "../../components/SecretForm";
import {
  getSecretById,
  updateSecret,
  ApiError,
} from "../../services/secretApi";
import { formatValidationErrors } from "../../lib/errorUtils";
import { Heading } from "../../components/heading";
import { Text } from "../../components/text";

/**
 * Page for editing an existing secret
 */
export function SecretEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string>("");
  const [initialValues, setInitialValues] = useState<Partial<SecretFormData>>(
    {}
  );

  useEffect(() => {
    if (!id) {
      setError("Secret ID is missing");
      setIsLoading(false);
      return;
    }

    const loadSecret = async () => {
      try {
        const secret = await getSecretById(id);
        setInitialValues({
          title: secret.title,
          username: secret.username || "",
          password: "", // Don't pre-fill password for security. If left blank, existing password remains unchanged
          url: secret.url || "",
          notes: secret.notes || "",
          tags: secret.tags || [],
          expires_at: secret.expires_at || undefined,
        });
      } catch (err) {
        if (err instanceof ApiError) {
          setError(err.message);
        } else {
          setError("Failed to load secret");
        }
      } finally {
        setIsLoading(false);
      }
    };

    loadSecret();
  }, [id]);

  const handleSubmit = async (data: SecretFormData) => {
    if (!id) return;

    setIsSubmitting(true);
    setError("");

    try {
      // Only send fields that were provided
      const updateData: Record<string, unknown> = {
        title: data.title,
      };

      if (data.username !== undefined) updateData.username = data.username;
      if (data.password !== undefined && data.password !== "")
        updateData.password = data.password;
      if (data.url !== undefined) updateData.url = data.url;
      if (data.notes !== undefined) updateData.notes = data.notes;
      if (data.tags.length > 0) updateData.tags = data.tags;
      if (data.expires_at !== undefined)
        updateData.expires_at = data.expires_at;

      await updateSecret(id, updateData);

      // Navigate to detail page on success
      navigate(`/secrets/${id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 422 && err.errors) {
          // Display validation errors
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
    navigate(`/secrets/${id}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Text>
          <Trans>Loading...</Trans>
        </Text>
      </div>
    );
  }

  if (error && !initialValues.title) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="mb-8">
        <Heading>
          <Trans>Edit Secret</Trans>
        </Heading>
        <Text className="mt-2">
          <Trans>Update the details of your secret.</Trans>
        </Text>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <SecretForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          submitLabel={t`Update`}
          initialValues={initialValues}
          isSubmitting={isSubmitting}
          error={error}
        />
      </div>
    </>
  );
}

export default SecretEdit;
