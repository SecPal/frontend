// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

/**
 * Site Edit Page
 * Epic #210 - Customer & Site Management
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import { FormSkeleton } from "@/ui/loading";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { getSite, updateSite } from "../../services/customersApi";
import type {
  Site,
  UpdateSiteRequest,
  Address,
  Contact,
} from "../../types/customers";
import { DomainAssignmentFields } from "../../components/DomainAssignmentFields";
import {
  Alert,
  AlertDescription,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  CustomerSiteLinkButton as LinkButton,
  CustomerSitePageText as PageText,
  CustomerSitePageTitle as PageTitle,
} from "@/ui";

export default function SiteEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { _ } = useLingui();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [site, setSite] = useState<Site | null>(null);

  const [formData, setFormData] = useState<UpdateSiteRequest>({});

  useEffect(() => {
    // Per-`id` cancellation flag: if a slow `getSite(prevId)` finishes
    // after the user has navigated to a new `/sites/:id/edit`, ignore
    // its result instead of refilling the form with the previous site's
    // values under the new URL. The same Bugbot HIGH severity finding
    // that flagged CustomerDetail, CustomerEdit, and SiteDetail applies
    // to this file: a Save click before the lagging fetch resolves
    // would have written the prior site's data to the new id.
    let cancelled = false;

    async function loadData() {
      if (!id) return;
      // Drop stale site / formData *synchronously* on every `id` change.
      // The loading skeleton is gated on `site === null`, so without this
      // reset a param-only navigation between `/sites/:id/edit` routes
      // would keep the previous site's form visible — and submitting it
      // before the new fetch resolves would write the old record's
      // values to the new id.
      setSite(null);
      setFormData({});
      setLoading(true);
      setError(null);
      setFieldErrors({});
      try {
        const siteData = await getSite(id);
        if (cancelled) return;
        setSite(siteData);
        setFormData({
          customer_id: siteData.customer_id,
          legal_entity_id: siteData.legal_entity_id,
          establishment_id: siteData.establishment_id,
          name: siteData.name,
          address: siteData.address,
          contact: siteData.contact,
        });
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error ? err.message : _(msg`Failed to load site`)
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [_, id]);

  function updateField(field: keyof UpdateSiteRequest, value: unknown) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      [field]: value,
    }));
  }

  function updateAddress(field: keyof Address, value: string) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      address: {
        ...(currentFormData.address || {}),
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

  function hasContactValue(contact: Contact | null | undefined) {
    return Boolean(contact?.name || contact?.email || contact?.phone);
  }

  function buildUpdatePayload(): UpdateSiteRequest {
    const payload: UpdateSiteRequest = {
      customer_id: formData.customer_id,
      legal_entity_id: formData.legal_entity_id,
      establishment_id: formData.establishment_id,
      name: formData.name,
      address: formData.address,
    };

    if (formData.contact !== undefined) {
      payload.contact = hasContactValue(formData.contact)
        ? formData.contact
        : null;
    }

    return payload;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      await updateSite(id, buildUpdatePayload());
      navigate(`/sites/${id}`);
    } catch (err: unknown) {
      // Parse validation errors from Laravel API
      const error = err as Error & { errors?: Record<string, string[]> };
      if (error.errors && typeof error.errors === "object") {
        setFieldErrors(error.errors);
        setError(_(msg`Please correct the errors below.`));
      } else {
        setError(error.message || _(msg`Failed to update site`));
      }
    } finally {
      setSaving(false);
    }
  }

  const isInitialLoading = loading && site === null;

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <PageTitle>
          <Trans>Edit Site</Trans>
        </PageTitle>
      </div>

      {isInitialLoading ? (
        <FormSkeleton loadingLabel={_(msg`Loading site form`)} fields={7} />
      ) : error && !site ? (
        <Alert className="mx-auto max-w-md border-destructive/30 bg-destructive/10 text-foreground">
          <AlertDescription className="text-destructive">
            {error}
          </AlertDescription>
        </Alert>
      ) : !site ? (
        <PageText className="py-12 text-center">
          <Trans>Site not found</Trans>
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
              <DomainAssignmentFields
                idPrefix="site"
                includeCustomer
                value={{
                  legal_entity_id: formData.legal_entity_id ?? "",
                  establishment_id: formData.establishment_id ?? "",
                  customer_id: formData.customer_id ?? "",
                }}
                onChange={(assignment) =>
                  setFormData((current) => ({ ...current, ...assignment }))
                }
                errors={fieldErrors}
                onClearErrors={(fields) =>
                  setFieldErrors((current) => {
                    const next = { ...current };
                    for (const field of fields) delete next[field];
                    return next;
                  })
                }
              />

              <Field>
                <FieldLabel htmlFor="site-name">
                  <Trans>Site Name</Trans> *
                </FieldLabel>
                <Input
                  id="site-name"
                  name="name"
                  type="text"
                  required
                  value={formData.name || ""}
                  aria-invalid={fieldErrors.name ? true : undefined}
                  aria-describedby={
                    fieldErrors.name ? "site-name-error" : undefined
                  }
                  onChange={(e) => updateField("name", e.target.value)}
                />
                {fieldErrors.name && (
                  <FieldError id="site-name-error">
                    {fieldErrors.name.join(", ")}
                  </FieldError>
                )}
              </Field>
            </FieldGroup>

            {/* Address */}
            <div>
              <PageTitle level={2} className="mb-4">
                <Trans>Address</Trans>
              </PageTitle>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="site-street">
                    <Trans>Street</Trans> *
                  </FieldLabel>
                  <Input
                    id="site-street"
                    name="street"
                    type="text"
                    required
                    autoComplete="street-address"
                    value={formData.address?.street || ""}
                    aria-invalid={
                      fieldErrors["address.street"] ? true : undefined
                    }
                    aria-describedby={
                      fieldErrors["address.street"]
                        ? "site-street-error"
                        : undefined
                    }
                    onChange={(e) => updateAddress("street", e.target.value)}
                  />
                  {fieldErrors["address.street"] && (
                    <FieldError id="site-street-error">
                      {fieldErrors["address.street"].join(", ")}
                    </FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="site-city">
                    <Trans>City</Trans> *
                  </FieldLabel>
                  <Input
                    id="site-city"
                    name="city"
                    type="text"
                    required
                    autoComplete="address-level2"
                    value={formData.address?.city || ""}
                    aria-invalid={
                      fieldErrors["address.city"] ? true : undefined
                    }
                    aria-describedby={
                      fieldErrors["address.city"]
                        ? "site-city-error"
                        : undefined
                    }
                    onChange={(e) => updateAddress("city", e.target.value)}
                  />
                  {fieldErrors["address.city"] && (
                    <FieldError id="site-city-error">
                      {fieldErrors["address.city"].join(", ")}
                    </FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="site-postal-code">
                    <Trans>Postal Code</Trans> *
                  </FieldLabel>
                  <Input
                    id="site-postal-code"
                    name="postal_code"
                    type="text"
                    required
                    autoComplete="postal-code"
                    value={formData.address?.postal_code || ""}
                    aria-invalid={
                      fieldErrors["address.postal_code"] ? true : undefined
                    }
                    aria-describedby={
                      fieldErrors["address.postal_code"]
                        ? "site-postal-code-error"
                        : undefined
                    }
                    onChange={(e) =>
                      updateAddress("postal_code", e.target.value)
                    }
                  />
                  {fieldErrors["address.postal_code"] && (
                    <FieldError id="site-postal-code-error">
                      {fieldErrors["address.postal_code"].join(", ")}
                    </FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="site-country">
                    <Trans>Country</Trans> *
                  </FieldLabel>
                  <Select
                    name="country"
                    required
                    value={formData.address?.country || "DE"}
                    onValueChange={(value) => updateAddress("country", value)}
                  >
                    <SelectTrigger
                      id="site-country"
                      aria-invalid={
                        fieldErrors["address.country"] ? true : undefined
                      }
                      aria-describedby={
                        fieldErrors["address.country"]
                          ? "site-country-error"
                          : undefined
                      }
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DE">{_(msg`Germany`)}</SelectItem>
                      <SelectItem value="AT">{_(msg`Austria`)}</SelectItem>
                      <SelectItem value="CH">{_(msg`Switzerland`)}</SelectItem>
                    </SelectContent>
                  </Select>
                  {fieldErrors["address.country"] && (
                    <FieldError id="site-country-error">
                      {fieldErrors["address.country"].join(", ")}
                    </FieldError>
                  )}
                </Field>
              </FieldGroup>
            </div>

            {/* Contact Person */}
            <div>
              <PageTitle level={2} className="mb-4">
                <Trans>Contact Person</Trans>{" "}
                <span className="text-muted-foreground">
                  <Trans>(Optional)</Trans>
                </span>
              </PageTitle>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="site-contact-name">
                    <Trans>Name</Trans>
                  </FieldLabel>
                  <Input
                    id="site-contact-name"
                    name="contact_name"
                    type="text"
                    autoComplete="name"
                    value={formData.contact?.name || ""}
                    aria-invalid={
                      fieldErrors["contact.name"] ? true : undefined
                    }
                    aria-describedby={
                      fieldErrors["contact.name"]
                        ? "site-contact-name-error"
                        : undefined
                    }
                    onChange={(e) => updateContact("name", e.target.value)}
                  />
                  {fieldErrors["contact.name"] && (
                    <FieldError id="site-contact-name-error">
                      {fieldErrors["contact.name"].join(", ")}
                    </FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="site-contact-email">
                    <Trans>Email</Trans>
                  </FieldLabel>
                  <Input
                    id="site-contact-email"
                    name="contact_email"
                    type="email"
                    autoComplete="email"
                    value={formData.contact?.email || ""}
                    aria-invalid={
                      fieldErrors["contact.email"] ? true : undefined
                    }
                    aria-describedby={
                      fieldErrors["contact.email"]
                        ? "site-contact-email-error"
                        : undefined
                    }
                    onChange={(e) => updateContact("email", e.target.value)}
                  />
                  {fieldErrors["contact.email"] && (
                    <FieldError id="site-contact-email-error">
                      {fieldErrors["contact.email"].join(", ")}
                    </FieldError>
                  )}
                </Field>

                <Field>
                  <FieldLabel htmlFor="site-contact-phone">
                    <Trans>Phone</Trans>
                  </FieldLabel>
                  <Input
                    id="site-contact-phone"
                    name="contact_phone"
                    type="tel"
                    autoComplete="tel"
                    value={formData.contact?.phone || ""}
                    aria-invalid={
                      fieldErrors["contact.phone"] ? true : undefined
                    }
                    aria-describedby={
                      fieldErrors["contact.phone"]
                        ? "site-contact-phone-error"
                        : undefined
                    }
                    onChange={(e) => updateContact("phone", e.target.value)}
                  />
                  {fieldErrors["contact.phone"] && (
                    <FieldError id="site-contact-phone-error">
                      {fieldErrors["contact.phone"].join(", ")}
                    </FieldError>
                  )}
                </Field>
              </FieldGroup>
            </div>

            {/* Actions */}
            <div className="flex gap-4 pt-4 border-t">
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Trans>Saving...</Trans>
                ) : (
                  <Trans>Save Changes</Trans>
                )}
              </Button>
              <LinkButton to={`/sites/${id}`} variant="outline">
                <Trans>Cancel</Trans>
              </LinkButton>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
