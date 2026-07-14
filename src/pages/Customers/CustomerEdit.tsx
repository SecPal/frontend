// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/**
 * Customer Edit Page
 * Epic #210 - Customer & Site Management
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { Button } from "@/ui/button";
import { Checkbox } from "@/ui/checkbox";
import { Input } from "@/ui/input";
import { FormSkeleton } from "@/ui/loading";
import { Textarea } from "@/ui/textarea";
import { getCustomer, updateCustomer } from "../../services/customersApi";
import type {
  Address,
  Contact,
  Customer,
  UpdateCustomerRequest,
} from "@/types/api/customers";
import {
  Alert,
  AlertDescription,
  Field,
  FieldGroup,
  FieldLabel,
  CustomerSiteFormCheckboxField as FormCheckboxField,
  CustomerSitePageText as PageText,
  CustomerSitePageTitle as PageTitle,
} from "@/ui";

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
    // Capture a per-`id` cancellation flag so that a slow fetch for the
    // *previous* id cannot overwrite formData after the user has already
    // navigated to a new `/customers/:id/edit`. Without this guard, a
    // late-resolving setFormData would refill the form with the previous
    // customer's values under the new URL, and a Save click would write
    // those stale values to the new id.
    let cancelled = false;

    async function loadCustomer() {
      if (!id) return;
      // Drop stale customer / formData *synchronously* on every `id` change.
      // The loading skeleton is gated on `customer === null`, so without
      // this reset a param-only navigation between `/customers/:id/edit`
      // routes would keep the previous customer's form visible — and
      // submitting it before the new fetch resolves would write the old
      // record's values to the new id.
      setCustomer(null);
      setFormData({});
      setLoading(true);
      setError(null);
      try {
        const data = await getCustomer(id);
        if (cancelled) return;
        setCustomer(data);
        setFormData({
          name: data.name,
          vat_id: data.vat_id ?? null,
          billing_address: data.billing_address,
          contact: data.contact,
          notes: data.notes,
          is_active: data.is_active,
        });
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : _(msg`Failed to load customer`)
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadCustomer();
    return () => {
      cancelled = true;
    };
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
      const vatId = formData.vat_id?.trim();
      await updateCustomer(id, {
        ...formData,
        vat_id: vatId || null,
      });
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
        <Alert className="mx-auto max-w-md border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      ) : !customer ? (
        <PageText className="py-12 text-center">
          <Trans>Customer not found</Trans>
        </PageText>
      ) : (
        <>
          {error && (
            <Alert className="mb-4 border-destructive/30 bg-destructive/10 text-foreground">
              <AlertDescription className="text-destructive">
                {error}
              </AlertDescription>
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
                  <FieldLabel htmlFor="customer-vat-id">
                    <Trans>VAT ID</Trans>
                  </FieldLabel>
                  <Input
                    id="customer-vat-id"
                    name="vat_id"
                    type="text"
                    maxLength={32}
                    autoComplete="off"
                    value={formData.vat_id ?? ""}
                    onChange={(e) =>
                      updateField("vat_id", e.target.value || null)
                    }
                  />
                </Field>

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
