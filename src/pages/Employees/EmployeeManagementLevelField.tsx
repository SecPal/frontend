// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import type { Ref } from "react";
import { Trans } from "@lingui/react/macro";
import { Input } from "@/ui/input";
import { Switch } from "@/ui/switch";
import { Field, FieldError, FieldLabel } from "@/ui";

interface EmployeeManagementLevelFieldProps {
  checked: boolean;
  describedBy?: string;
  error?: string;
  inputRef?: Ref<HTMLInputElement>;
  noManagementPlaceholder: string;
  onCheckedChange: (checked: boolean) => void;
  onValueChange: (value: number) => void;
  value: number;
}

export function EmployeeManagementLevelField({
  checked,
  describedBy,
  error,
  inputRef,
  noManagementPlaceholder,
  onCheckedChange,
  onValueChange,
  value,
}: EmployeeManagementLevelFieldProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <FieldLabel htmlFor="is_leadership">
          <Trans>Leadership Position</Trans>
        </FieldLabel>
        <Switch
          id="is_leadership"
          name="is_leadership"
          checked={checked}
          showIcons
          onChange={onCheckedChange}
        />
      </div>

      <Field>
        <div className="relative">
          {checked ? (
            <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center px-3 text-sm text-muted-foreground">
              <Trans>ML</Trans>
            </span>
          ) : null}
          <Input
            id="management_level"
            ref={inputRef}
            type="number"
            name="management_level"
            min="1"
            max="255"
            placeholder={checked ? "?" : noManagementPlaceholder}
            disabled={!checked}
            required={checked}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy}
            value={checked && value > 0 ? value : ""}
            onChange={(event) =>
              onValueChange(event.target.value ? Number(event.target.value) : 0)
            }
            className={checked ? "pl-11" : undefined}
          />
        </div>
        {error ? (
          <FieldError id="management_level-error">{error}</FieldError>
        ) : null}
      </Field>
    </div>
  );
}
