// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState, FormEvent, useMemo } from "react";
import { Button } from "@headlessui/react";
import { generatePassword, assessPasswordStrength } from "../lib/passwordUtils";

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

// Helper functions for password strength indicator styling
type PasswordStrengthLevel = "weak" | "medium" | "strong" | "very-strong";

function getStrengthStyles(strength: PasswordStrengthLevel): string {
  const styles: Record<PasswordStrengthLevel, string> = {
    weak: "w-1/4 bg-red-500",
    medium: "w-2/4 bg-yellow-500",
    strong: "w-3/4 bg-green-500",
    "very-strong": "w-full bg-green-600",
  };
  return styles[strength] ?? styles.weak;
}

function getStrengthTextColor(strength: PasswordStrengthLevel): string {
  const colors: Record<PasswordStrengthLevel, string> = {
    weak: "text-red-600 dark:text-red-400",
    medium: "text-yellow-600 dark:text-yellow-400",
    strong: "text-green-600 dark:text-green-400",
    "very-strong": "text-green-700 dark:text-green-300",
  };
  return colors[strength] ?? colors.weak;
}

function getStrengthLabel(strength: PasswordStrengthLevel): string {
  const labels: Record<PasswordStrengthLevel, string> = {
    weak: "Weak",
    medium: "Medium",
    strong: "Strong",
    "very-strong": "Very Strong",
  };
  return labels[strength] ?? labels.weak;
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
  const [tagInput, setTagInput] = useState<string>("");

  // Memoize password strength to avoid recalculating on every render
  const passwordStrength = useMemo(
    () =>
      formData.password ? assessPasswordStrength(formData.password) : null,
    [formData.password]
  );

  const handleGeneratePassword = () => {
    const newPassword = generatePassword(16);
    setFormData((prev) => ({ ...prev, password: newPassword }));
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !formData.tags.includes(tag)) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tag],
      }));
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((tag) => tag !== tagToRemove),
    }));
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    } else if (
      e.key === "Backspace" &&
      tagInput === "" &&
      formData.tags.length > 0
    ) {
      // Remove last tag on backspace when input is empty
      const lastTag = formData.tags[formData.tags.length - 1];
      if (lastTag) {
        handleRemoveTag(lastTag);
      }
    }
  };

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
    <form onSubmit={handleSubmit} className="space-y-6" role="form">
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
          <button
            type="button"
            onClick={handleGeneratePassword}
            aria-label="Generate password"
            title="Generate secure password"
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
          >
            Generate
          </button>
        </div>

        {/* Password Strength Indicator */}
        {passwordStrength && formData.password.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className={`h-full transition-all duration-300 ${getStrengthStyles(
                    passwordStrength.strength as PasswordStrengthLevel
                  )}`}
                />
              </div>
              <span
                className={`text-xs font-medium ${getStrengthTextColor(
                  passwordStrength.strength as PasswordStrengthLevel
                )}`}
              >
                {getStrengthLabel(
                  passwordStrength.strength as PasswordStrengthLevel
                )}
              </span>
            </div>
            {passwordStrength.feedback.length > 0 && (
              <ul className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
                {passwordStrength.feedback.map((fb, idx) => (
                  <li key={idx}>• {fb}</li>
                ))}
              </ul>
            )}
          </div>
        )}
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

      {/* Tags */}
      <div>
        <label
          htmlFor="tag-input"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Tags
        </label>
        <div className="mt-1">
          {/* Display existing tags */}
          {formData.tags.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  #{tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                    className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          {/* Tag input */}
          <div className="flex gap-2">
            <input
              type="text"
              id="tag-input"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagInputKeyDown}
              disabled={isSubmitting}
              placeholder="Enter tag name"
              className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:outline-none focus:ring-1 focus:ring-zinc-900 disabled:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:focus:border-white dark:focus:ring-white"
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={isSubmitting || !tagInput.trim()}
              className="rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              Add
            </button>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Press Enter to add a tag
          </p>
        </div>
      </div>

      {/* Expiration Date */}
      <div>
        <label
          htmlFor="expires_at"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Expiration Date (Optional)
        </label>
        <input
          type="date"
          id="expires_at"
          value={formData.expires_at?.split("T")[0] ?? ""}
          onChange={(e) =>
            handleChange(
              "expires_at",
              e.target.value ? `${e.target.value}T23:59:59Z` : ""
            )
          }
          disabled={isSubmitting}
          min={new Date().toISOString().split("T")[0]}
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
          {isSubmitting ? `${submitLabel}...` : submitLabel}
        </Button>
      </div>
    </form>
  );
}
