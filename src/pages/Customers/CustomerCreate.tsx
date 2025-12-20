// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Customer Create Page
 * Epic #210 - Customer & Site Management
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { createCustomer } from "../../services/customersApi";
import type {
  CreateCustomerRequest,
  Address,
  Contact,
} from "../../types/customers";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Input } from "../../components/input";
import { Field, Label, FieldGroup } from "../../components/fieldset";
import { Textarea } from "../../components/textarea";
import { Checkbox, CheckboxField } from "../../components/checkbox";

export default function CustomerCreate() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateCustomerRequest>({
    name: "",
    billing_address: {
      street: "",
      city: "",
      postal_code: "",
      country: "DE",
    },
    contact: {
      name: "",
      email: "",
      phone: "",
    },
    is_active: true,
  });

  function updateField(field: keyof CreateCustomerRequest, value: unknown) {
    setFormData({ ...formData, [field]: value });
  }

  function updateAddress(field: keyof Address, value: string) {
    setFormData({
      ...formData,
      billing_address: { ...formData.billing_address, [field]: value },
    });
  }

  function updateContact(field: keyof Contact, value: string) {
    setFormData({
      ...formData,
      contact: { ...(formData.contact || {}), [field]: value } as Contact,
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Clean up the data before sending
      const dataToSend: CreateCustomerRequest = {
        name: formData.name,
        billing_address: formData.billing_address,
        is_active: formData.is_active,
      };

      // Only include contact if at least one field is filled
      if (
        formData.contact &&
        (formData.contact.name ||
          formData.contact.email ||
          formData.contact.phone)
      ) {
        dataToSend.contact = formData.contact;
      }

      // Only include notes if not empty
      if (formData.notes && formData.notes.trim()) {
        dataToSend.notes = formData.notes;
      }

      const customer = await createCustomer(dataToSend);
      navigate(`/customers/${customer.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create customer"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Heading>
          <Trans>New Customer</Trans>
        </Heading>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <FieldGroup>
          <Field>
            <Label>
              <Trans>Customer Name</Trans> *
            </Label>
            <Input
              name="name"
              type="text"
              required
              autoComplete="organization"
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
            />
          </Field>
        </FieldGroup>

        {/* Billing Address */}
        <div>
          <Heading level={2} className="mb-4">
            <Trans>Billing Address</Trans>
          </Heading>
          <FieldGroup>
            <Field>
              <Label>
                <Trans>Street</Trans> *
              </Label>
              <Input
                name="street"
                type="text"
                required
                autoComplete="street-address"
                value={formData.billing_address.street}
                onChange={(e) => updateAddress("street", e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field>
                <Label>
                  <Trans>Postal Code</Trans> *
                </Label>
                <Input
                  name="postal_code"
                  type="text"
                  required
                  autoComplete="postal-code"
                  value={formData.billing_address.postal_code}
                  onChange={(e) => updateAddress("postal_code", e.target.value)}
                />
              </Field>

              <Field>
                <Label>
                  <Trans>City</Trans> *
                </Label>
                <Input
                  name="city"
                  type="text"
                  required
                  autoComplete="address-level2"
                  value={formData.billing_address.city}
                  onChange={(e) => updateAddress("city", e.target.value)}
                />
              </Field>
            </div>

            <Field>
              <Label>
                <Trans>Country</Trans> *
              </Label>
              <Input
                name="country"
                type="text"
                required
                maxLength={2}
                placeholder="DE"
                autoComplete="country"
                value={formData.billing_address.country}
                onChange={(e) =>
                  updateAddress("country", e.target.value.toUpperCase())
                }
              />
            </Field>
          </FieldGroup>
        </div>

        {/* Contact Information */}
        <div>
          <Heading level={2} className="mb-4">
            <Trans>Contact Person</Trans>
          </Heading>
          <FieldGroup>
            <Field>
              <Label>
                <Trans>Name</Trans>
              </Label>
              <Input
                name="contact_name"
                type="text"
                autoComplete="name"
                value={formData.contact?.name || ""}
                onChange={(e) => updateContact("name", e.target.value)}
              />
            </Field>

            <Field>
              <Label>
                <Trans>Email</Trans>
              </Label>
              <Input
                name="contact_email"
                type="email"
                autoComplete="email"
                value={formData.contact?.email || ""}
                onChange={(e) => updateContact("email", e.target.value)}
              />
            </Field>

            <Field>
              <Label>
                <Trans>Phone</Trans>
              </Label>
              <Input
                name="contact_phone"
                type="tel"
                autoComplete="tel"
                value={formData.contact?.phone || ""}
                onChange={(e) => updateContact("phone", e.target.value)}
              />
            </Field>
          </FieldGroup>
        </div>

        {/* Additional Information */}
        <Field>
          <Label>
            <Trans>Notes</Trans>
          </Label>
          <Textarea
            name="notes"
            rows={4}
            value={formData.notes || ""}
            onChange={(e) => updateField("notes", e.target.value)}
          />
        </Field>

        <CheckboxField>
          <Checkbox
            name="is_active"
            checked={formData.is_active}
            onChange={(checked) => updateField("is_active", checked)}
          />
          <Label>
            <Trans>Active</Trans>
          </Label>
        </CheckboxField>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={loading}>
            {loading ? (
              <Trans>Creating...</Trans>
            ) : (
              <Trans>Create Customer</Trans>
            )}
          </Button>
          <Button type="button" outline onClick={() => navigate("/customers")}>
            <Trans>Cancel</Trans>
          </Button>
        </div>
      </form>
    </div>
  );
}
