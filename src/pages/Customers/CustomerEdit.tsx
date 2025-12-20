// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Customer Edit Page
 * Epic #210 - Customer & Site Management
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { getCustomer, updateCustomer } from "../../services/customersApi";
import type {
  Customer,
  UpdateCustomerRequest,
  Address,
  Contact,
} from "../../types/customers";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Input } from "../../components/input";
import { Field, Label, FieldGroup } from "../../components/fieldset";
import { Textarea } from "../../components/textarea";
import { Checkbox, CheckboxField } from "../../components/checkbox";

export default function CustomerEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);

  const [formData, setFormData] = useState<UpdateCustomerRequest>({});

  useEffect(() => {
    async function loadCustomer() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getCustomer(id);
        setCustomer(data);
        setFormData({
          name: data.name,
          billing_address: data.billing_address,
          contact: data.contact,
          notes: data.notes,
          is_active: data.is_active,
        });
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load customer"
        );
      } finally {
        setLoading(false);
      }
    }
    loadCustomer();
  }, [id]);

  function updateField(field: keyof UpdateCustomerRequest, value: unknown) {
    setFormData({ ...formData, [field]: value });
  }

  function updateAddress(field: keyof Address, value: string) {
    setFormData({
      ...formData,
      billing_address: { ...formData.billing_address!, [field]: value },
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
    if (!id) return;

    setSaving(true);
    setError(null);

    try {
      await updateCustomer(id, formData);
      navigate(`/customers/${id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to update customer"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <Trans>Loading...</Trans>
      </div>
    );
  }

  if (error && !customer) {
    return <div className="text-center py-12 text-red-600">{error}</div>;
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <Trans>Customer not found</Trans>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Heading>
          <Trans>Edit Customer</Trans>
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
              value={formData.name || ""}
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
                value={formData.billing_address?.street || ""}
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
                  value={formData.billing_address?.postal_code || ""}
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
                  value={formData.billing_address?.city || ""}
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
                value={formData.billing_address?.country || ""}
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
            checked={formData.is_active || false}
            onChange={(checked) => updateField("is_active", checked)}
          />
          <Label>
            <Trans>Active</Trans>
          </Label>
        </CheckboxField>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={saving}>
            {saving ? <Trans>Saving...</Trans> : <Trans>Save Changes</Trans>}
          </Button>
          <Button
            type="button"
            outline
            onClick={() => navigate(`/customers/${id}`)}
          >
            <Trans>Cancel</Trans>
          </Button>
        </div>
      </form>
    </div>
  );
}
