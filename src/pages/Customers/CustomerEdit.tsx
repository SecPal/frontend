// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Customer Edit Page
 * Epic #210 - Customer & Site Management
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { FormSkeleton } from "@/ui";
import { getCustomer, updateCustomer } from "../../services/customersApi";
import type {
  Customer,
  UpdateCustomerRequest,
  Address,
  Contact,
} from "../../types/customers";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Field,
  FieldGroup,
  FieldLabel,
  FormCheckboxField,
  Input,
  PageText,
  PageTitle,
  Textarea,
} from "../CustomerSites/ui";

export default function CustomerEdit() {
  const { _ } = useLingui();
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
          err instanceof Error ? err.message : _(msg`Failed to load customer`)
        );
      } finally {
        setLoading(false);
      }
    }
    loadCustomer();
  }, [_, id]);

  function updateField(field: keyof UpdateCustomerRequest, value: unknown) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      [field]: value,
    }));
  }

  function updateAddress(field: keyof Address, value: string) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      billing_address: {
        ...(currentFormData.billing_address || {}),
        [field]: value,
      } as Address,
    }));
  }

  function updateContact(field: keyof Contact, value: string) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      contact: {
        ...(currentFormData.contact || {}),
        [field]: value,
      } as Contact,
    }));
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
        err instanceof Error ? err.message : _(msg`Failed to update customer`)
      );
    } finally {
      setSaving(false);
    }
  }

  const isInitialLoading = loading && customer === null;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <PageTitle>
          <Trans>Edit Customer</Trans>
        </PageTitle>
      </div>

      {isInitialLoading ? (
        <FormSkeleton loadingLabel={_(msg`Loading customer form`)} fields={8} />
      ) : error && !customer ? (
        <PageText className="py-12 text-center text-red-600 dark:text-red-400">
          {error}
        </PageText>
      ) : !customer ? (
        <PageText className="py-12 text-center">
          <Trans>Customer not found</Trans>
        </PageText>
      ) : (
        <>
          {error && (
            <Alert className="mb-4 border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="customer-name">
                  <Trans>Customer Name</Trans> *
                </FieldLabel>
                <Input
                  id="customer-name"
                  name="name"
                  type="text"
                  required
                  autoComplete="organization"
                  value={formData.name || ""}
                  onChange={(e) => updateField("name", e.target.value)}
                />
              </Field>
            </FieldGroup>

            {/* Billing Address */}
            <div>
              <PageTitle level={2} className="mb-4">
                <Trans>Billing Address</Trans>
              </PageTitle>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="customer-street">
                    <Trans>Street</Trans> *
                  </FieldLabel>
                  <Input
                    id="customer-street"
                    name="street"
                    type="text"
                    required
                    autoComplete="street-address"
                    value={formData.billing_address?.street || ""}
                    onChange={(e) => updateAddress("street", e.target.value)}
                  />
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="customer-postal-code">
                      <Trans>Postal Code</Trans> *
                    </FieldLabel>
                    <Input
                      id="customer-postal-code"
                      name="postal_code"
                      type="text"
                      required
                      autoComplete="postal-code"
                      value={formData.billing_address?.postal_code || ""}
                      onChange={(e) =>
                        updateAddress("postal_code", e.target.value)
                      }
                    />
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="customer-city">
                      <Trans>City</Trans> *
                    </FieldLabel>
                    <Input
                      id="customer-city"
                      name="city"
                      type="text"
                      required
                      autoComplete="address-level2"
                      value={formData.billing_address?.city || ""}
                      onChange={(e) => updateAddress("city", e.target.value)}
                    />
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="customer-country">
                    <Trans>Country</Trans> *
                  </FieldLabel>
                  <Input
                    id="customer-country"
                    name="country"
                    type="text"
                    required
                    maxLength={2}
                    placeholder="DE"
                    autoComplete="country"
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
              <PageTitle level={2} className="mb-4">
                <Trans>Contact Person</Trans>
              </PageTitle>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="customer-contact-name">
                    <Trans>Name</Trans>
                  </FieldLabel>
                  <Input
                    id="customer-contact-name"
                    name="contact_name"
                    type="text"
                    autoComplete="name"
                    value={formData.contact?.name || ""}
                    onChange={(e) => updateContact("name", e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="customer-contact-email">
                    <Trans>Email</Trans>
                  </FieldLabel>
                  <Input
                    id="customer-contact-email"
                    name="contact_email"
                    type="email"
                    autoComplete="email"
                    value={formData.contact?.email || ""}
                    onChange={(e) => updateContact("email", e.target.value)}
                  />
                </Field>

                <Field>
                  <FieldLabel htmlFor="customer-contact-phone">
                    <Trans>Phone</Trans>
                  </FieldLabel>
                  <Input
                    id="customer-contact-phone"
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
              <FieldLabel htmlFor="customer-notes">
                <Trans>Notes</Trans>
              </FieldLabel>
              <Textarea
                id="customer-notes"
                name="notes"
                rows={4}
                value={formData.notes || ""}
                onChange={(e) => updateField("notes", e.target.value)}
              />
            </Field>

            <FormCheckboxField>
              <Checkbox
                id="customer-is-active"
                name="is_active"
                checked={formData.is_active || false}
                onCheckedChange={(checked) =>
                  updateField("is_active", checked === true)
                }
              />
              <FieldLabel htmlFor="customer-is-active">
                <Trans>Active</Trans>
              </FieldLabel>
            </FormCheckboxField>

            {/* Actions */}
            <div className="flex gap-4">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Trans>Saving...</Trans>
                ) : (
                  <Trans>Save Changes</Trans>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate(`/customers/${id}`)}
              >
                <Trans>Cancel</Trans>
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
