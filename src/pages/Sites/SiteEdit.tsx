// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Site Edit Page
 * Epic #210 - Customer & Site Management
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import {
  getSite,
  updateSite,
  listCustomers,
} from "../../services/customersApi";
import { listOrganizationalUnits } from "../../services/organizationalUnitApi";
import type {
  Site,
  UpdateSiteRequest,
  Address,
  Contact,
  SiteType,
  Customer,
} from "../../types/customers";
import type { OrganizationalUnit } from "../../types/organizational";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FormCheckboxField,
  Input,
  LinkButton,
  PageText,
  PageTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Spinner,
  Textarea,
} from "../CustomerSites/ui";

export default function SiteEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { _ } = useLingui();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [site, setSite] = useState<Site | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrganizationalUnit[]>([]);

  const [formData, setFormData] = useState<UpdateSiteRequest>({});

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const [siteData, customersData, orgUnitsData] = await Promise.all([
          getSite(id),
          listCustomers({ per_page: 100 }),
          listOrganizationalUnits({ per_page: 100 }),
        ]);
        setSite(siteData);
        setCustomers(customersData.data);
        setOrgUnits(orgUnitsData.data);
        setFormData({
          customer_id: siteData.customer_id,
          organizational_unit_id: siteData.organizational_unit_id,
          name: siteData.name,
          type: siteData.type,
          address: siteData.address,
          contact: siteData.contact,
          access_instructions: siteData.access_instructions,
          notes: siteData.notes,
          is_active: siteData.is_active,
          valid_from: siteData.valid_from,
          valid_until: siteData.valid_until,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : _(msg`Failed to load site`));
      } finally {
        setLoading(false);
      }
    }
    loadData();
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    setError(null);
    setFieldErrors({});

    try {
      await updateSite(id, formData);
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

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 py-12 text-sm text-zinc-600 dark:text-zinc-300">
        <Spinner aria-label={_(msg`Loading...`)} />
        <span>
          <Trans>Loading...</Trans>
        </span>
      </div>
    );
  }

  if (error && !site) {
    return (
      <PageText className="py-12 text-center text-red-600 dark:text-red-400">
        {error}
      </PageText>
    );
  }

  if (!site) {
    return (
      <div className="text-center py-12">
        <Trans>Site not found</Trans>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <PageTitle>
          <Trans>Edit Site</Trans>
        </PageTitle>
      </div>

      {error && (
        <Alert className="mb-4 border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="site-customer">
              <Trans>Customer</Trans> *
            </FieldLabel>
            <Select
              name="customer_id"
              required
              value={formData.customer_id || ""}
              onValueChange={(value) => updateField("customer_id", value)}
            >
              <SelectTrigger
                id="site-customer"
                aria-invalid={fieldErrors.customer_id ? true : undefined}
                aria-describedby={
                  fieldErrors.customer_id ? "site-customer-error" : undefined
                }
              >
                <SelectValue placeholder={_(msg`Select customer...`)} />
              </SelectTrigger>
              <SelectContent>
                {customers.map((customer) => (
                  <SelectItem key={customer.id} value={customer.id}>
                    {customer.customer_number} - {customer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.customer_id && (
              <FieldError id="site-customer-error">
                {fieldErrors.customer_id.join(", ")}
              </FieldError>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="site-organizational-unit">
              <Trans>Organizational Unit</Trans> *
            </FieldLabel>
            <Select
              name="organizational_unit_id"
              required
              value={formData.organizational_unit_id || ""}
              onValueChange={(value) =>
                updateField("organizational_unit_id", value)
              }
            >
              <SelectTrigger
                id="site-organizational-unit"
                aria-invalid={
                  fieldErrors.organizational_unit_id ? true : undefined
                }
                aria-describedby={
                  fieldErrors.organizational_unit_id
                    ? "site-organizational-unit-error"
                    : undefined
                }
              >
                <SelectValue placeholder={_(msg`Select organizational unit...`)} />
              </SelectTrigger>
              <SelectContent>
                {orgUnits.map((unit) => (
                  <SelectItem key={unit.id} value={unit.id}>
                    {unit.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.organizational_unit_id && (
              <FieldError id="site-organizational-unit-error">
                {fieldErrors.organizational_unit_id.join(", ")}
              </FieldError>
            )}
          </Field>

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
              aria-describedby={fieldErrors.name ? "site-name-error" : undefined}
              onChange={(e) => updateField("name", e.target.value)}
            />
            {fieldErrors.name && (
              <FieldError id="site-name-error">
                {fieldErrors.name.join(", ")}
              </FieldError>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="site-type">
              <Trans>Type</Trans> *
            </FieldLabel>
            <Select
              name="type"
              required
              value={formData.type || "permanent"}
              onValueChange={(value) => updateField("type", value as SiteType)}
            >
              <SelectTrigger id="site-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="permanent">{_(msg`Permanent`)}</SelectItem>
                <SelectItem value="temporary">{_(msg`Temporary`)}</SelectItem>
              </SelectContent>
            </Select>
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
                onChange={(e) => updateAddress("street", e.target.value)}
              />
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
                onChange={(e) => updateAddress("city", e.target.value)}
              />
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
                onChange={(e) => updateAddress("postal_code", e.target.value)}
              />
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
                <SelectTrigger id="site-country">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DE">{_(msg`Germany`)}</SelectItem>
                  <SelectItem value="AT">{_(msg`Austria`)}</SelectItem>
                  <SelectItem value="CH">{_(msg`Switzerland`)}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
        </div>

        {/* Contact Person */}
        <div>
          <PageTitle level={2} className="mb-4">
            <Trans>Contact Person</Trans>{" "}
            <span className="text-zinc-500">
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
                onChange={(e) => updateContact("name", e.target.value)}
              />
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
                onChange={(e) => updateContact("email", e.target.value)}
              />
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
                onChange={(e) => updateContact("phone", e.target.value)}
              />
            </Field>
          </FieldGroup>
        </div>

        {/* Validity Period */}
        <div>
          <PageTitle level={2} className="mb-4">
            <Trans>Validity Period</Trans>{" "}
            <span className="text-zinc-500">
              <Trans>(Optional)</Trans>
            </span>
          </PageTitle>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="site-valid-from">
                <Trans>Valid From</Trans>
              </FieldLabel>
              <Input
                id="site-valid-from"
                name="valid_from"
                type="date"
                value={formData.valid_from || ""}
                onChange={(e) => updateField("valid_from", e.target.value)}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="site-valid-until">
                <Trans>Valid Until</Trans>
              </FieldLabel>
              <Input
                id="site-valid-until"
                name="valid_until"
                type="date"
                value={formData.valid_until || ""}
                onChange={(e) => updateField("valid_until", e.target.value)}
              />
            </Field>
          </FieldGroup>
        </div>

        {/* Access Instructions */}
        <Field>
          <FieldLabel htmlFor="site-access-instructions">
            <Trans>Access Instructions</Trans>
          </FieldLabel>
          <Textarea
            id="site-access-instructions"
            name="access_instructions"
            rows={4}
            value={formData.access_instructions || ""}
            onChange={(e) => updateField("access_instructions", e.target.value)}
          />
        </Field>

        {/* Notes */}
        <Field>
          <FieldLabel htmlFor="site-notes">
            <Trans>Notes</Trans>
          </FieldLabel>
          <Textarea
            id="site-notes"
            name="notes"
            rows={4}
            value={formData.notes || ""}
            onChange={(e) => updateField("notes", e.target.value)}
          />
        </Field>

        {/* Active Status */}
        <FormCheckboxField>
          <Checkbox
            id="site-is-active"
            name="is_active"
            checked={formData.is_active}
            onCheckedChange={(checked) => updateField("is_active", checked === true)}
          />
          <FieldLabel htmlFor="site-is-active">
            <Trans>Active</Trans>
          </FieldLabel>
        </FormCheckboxField>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t">
          <Button type="submit" disabled={saving}>
            {saving ? <Trans>Saving...</Trans> : <Trans>Save Changes</Trans>}
          </Button>
          <LinkButton to={`/sites/${id}`} variant="outline">
            <Trans>Cancel</Trans>
          </LinkButton>
        </div>
      </form>
    </div>
  );
}
