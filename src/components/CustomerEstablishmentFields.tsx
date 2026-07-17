// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { Textarea } from "@/ui/textarea";
import type { EstablishmentLookup } from "@/types/api/customers";

export interface CustomerEstablishmentFormValue {
  key: string;
  id?: string;
  establishment_id: string;
  contact_name: string;
  email: string;
  phone: string;
  comments: string;
}

interface Props {
  assignments: CustomerEstablishmentFormValue[];
  establishments: EstablishmentLookup[];
  disabled?: boolean;
  onChange: (key: string, value: CustomerEstablishmentFormValue) => void;
  onAdd: () => void;
  onRemove: (key: string) => void;
}

export function CustomerEstablishmentFields({
  assignments,
  establishments,
  disabled = false,
  onChange,
  onAdd,
  onRemove,
}: Props) {
  return (
    <div className="space-y-4">
      {assignments.map((assignment, index) => {
        const number = index + 1;
        const update = (
          field: keyof CustomerEstablishmentFormValue,
          value: string
        ) => onChange(assignment.key, { ...assignment, [field]: value });
        return (
          <fieldset
            key={assignment.key}
            className="space-y-4 rounded-md border border-border p-4"
          >
            <legend className="px-1 font-medium">Establishment {number}</legend>
            <label className="grid gap-2">
              <span>Establishment {number} *</span>
              <select
                aria-label={`Establishment ${number}`}
                value={assignment.establishment_id}
                required
                disabled={disabled}
                onChange={(event) =>
                  update("establishment_id", event.target.value)
                }
                className="border-input bg-background h-10 rounded-md border px-3"
              >
                <option value="">Select establishment...</option>
                {establishments.map((establishment) => (
                  <option key={establishment.id} value={establishment.id}>
                    {establishment.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid gap-2">
                <span>Local contact name {number}</span>
                <Input
                  aria-label={`Local contact name ${number}`}
                  value={assignment.contact_name}
                  onChange={(event) =>
                    update("contact_name", event.target.value)
                  }
                />
              </label>
              <label className="grid gap-2">
                <span>Local email {number}</span>
                <Input
                  aria-label={`Local email ${number}`}
                  type="email"
                  value={assignment.email}
                  onChange={(event) => update("email", event.target.value)}
                />
              </label>
              <label className="grid gap-2">
                <span>Local phone {number}</span>
                <Input
                  aria-label={`Local phone ${number}`}
                  type="tel"
                  value={assignment.phone}
                  onChange={(event) => update("phone", event.target.value)}
                />
              </label>
              <label className="grid gap-2 sm:col-span-2">
                <span>Local comments {number}</span>
                <Textarea
                  aria-label={`Local comments ${number}`}
                  value={assignment.comments}
                  onChange={(event) => update("comments", event.target.value)}
                />
              </label>
            </div>
            {assignments.length > 1 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => onRemove(assignment.key)}
              >
                Remove establishment {number}
              </Button>
            ) : null}
          </fieldset>
        );
      })}
      <Button
        type="button"
        variant="outline"
        onClick={onAdd}
        disabled={disabled}
      >
        Add establishment
      </Button>
    </div>
  );
}
