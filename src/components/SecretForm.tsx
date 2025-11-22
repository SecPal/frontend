// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, FormEvent } from "react";
import { Button } from "@headlessui/react";

export interface SecretFormData {
  title: string;
  username: string;
  password: string;
  url: string;
  notes: string;
  tags: string[];
  expires_at?: string;
}

export interface SecretFormProps {
  onSubmit: (data: SecretFormData) => void | Promise<void>;
  onCancel: () => void;
  submitLabel: string;
  initialValues?: Partial<SecretFormData>;
  isSubmitting?: boolean;
  error?: string;
}

/**
 * Reusable form component for creating and editing secrets
 *
 * Features:
 * - All secret fields (title, username, password, URL, notes, tags, expiration)
 * - Password show/hide toggle
 * - Client-side validation
 * - Loading states
 * - Error display
 */
export function SecretForm({
  onSubmit,
  onCancel,
  submitLabel,
  initialValues = {},
  isSubmitting = false,
  error,
}: SecretFormProps) {
  const [formData, setFormData] = useState<SecretFormData>({
    title: initialValues.title || "",
    username: initialValues.username || "",
    password: initialValues.password || "",
    url: initialValues.url || "",
    notes: initialValues.notes || "",
    tags: initialValues.tags || [],
    expires_at: initialValues.expires_at,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [validationError, setValidationError] = useState<string>("");

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setValidationError("");

    // Validate required fields
    if (!formData.title || formData.title.trim() === "") {
      setValidationError("Title is required");
      return;
    }

    await onSubmit(formData);
  };

  const handleChange = (
    field: keyof SecretFormData,
    value: string | string[]
  ) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setValidationError(""); // Clear validation error on change
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Error Message */}
      {(error || validationError) && (
        <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/30 dark:text-red-400">
          {error || validationError}
        </div>
      )}

      {/* Title (Required) */}
      <div>
        <label
          htmlFor="title"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Title <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          id="title"
          value={formData.title}
          onChange={(e) => handleChange("title", e.target.value)}
          disabled={isSubmitting}
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
          required
        />
      </div>

      {/* Username */}
      <div>
        <label
          htmlFor="username"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Username
        </label>
        <input
          type="text"
          id="username"
          value={formData.username}
          onChange={(e) => handleChange("username", e.target.value)}
          disabled={isSubmitting}
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
        />
      </div>

      {/* Password */}
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Password
        </label>
        <div className="mt-1 flex gap-2">
          <input
            type={showPassword ? "text" : "password"}
            id="password"
            value={formData.password}
            onChange={(e) => handleChange("password", e.target.value)}
            disabled={isSubmitting}
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </div>

      {/* URL */}
      <div>
        <label
          htmlFor="url"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          URL
        </label>
        <input
          type="url"
          id="url"
          value={formData.url}
          onChange={(e) => handleChange("url", e.target.value)}
          disabled={isSubmitting}
          placeholder="https://example.com"
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
        />
      </div>

      {/* Notes */}
      <div>
        <label
          htmlFor="notes"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Notes
        </label>
        <textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => handleChange("notes", e.target.value)}
          disabled={isSubmitting}
          rows={4}
          className="mt-1 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
        />
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <Button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          {isSubmitting
            ? `${submitLabel.replace(/e$/, "")}ing...`
            : submitLabel}
        </Button>
      </div>
    </form>
  );
}
