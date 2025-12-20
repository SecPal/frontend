// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Site Edit Page
 * Epic #210 - Customer & Site Management
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import {
  getSite,
  updateSite,
  listCustomers,
} from "../../services/customersApi";
import { listOrganizationalUnits } from "../../lib/organizationalUnitStore";
import type {
  Site,
  UpdateSiteRequest,
  Address,
  Contact,
  SiteType,
  Customer,
} from "../../types/customers";
import type { OrganizationalUnitCacheEntry } from "../../lib/db";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Input } from "../../components/input";
import {
  Field,
  Label,
  FieldGroup,
  Description,
} from "../../components/fieldset";
import { Textarea } from "../../components/textarea";
import { Checkbox, CheckboxField } from "../../components/checkbox";
import { Select } from "../../components/select";

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
  const [orgUnits, setOrgUnits] = useState<OrganizationalUnitCacheEntry[]>([]);

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
          listOrganizationalUnits(),
        ]);
        setSite(siteData);
        setCustomers(customersData.data);
        setOrgUnits(orgUnitsData);
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
        setError(err instanceof Error ? err.message : "Failed to load site");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  function updateField(field: keyof UpdateSiteRequest, value: unknown) {
    setFormData({ ...formData, [field]: value });
  }

  function updateAddress(field: keyof Address, value: string) {
    setFormData({
      ...formData,
      address: {
        ...(formData.address || {}),
        [field]: value,
      } as Address,
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
    setFieldErrors({});

    try {
      await updateSite(id, formData);
      navigate(`/sites/${id}`);
    } catch (err: unknown) {
      // Parse validation errors from Laravel API
      const error = err as Error & { errors?: Record<string, string[]> };
      if (error.errors && typeof error.errors === "object") {
        setFieldErrors(error.errors);
        setError("Please correct the errors below.");
      } else {
        setError(error.message || "Failed to update site");
      }
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

  if (error && !site) {
    return (
      <div className="text-center py-12 text-red-600 dark:text-red-400">
        {error}
      </div>
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
        <Heading>
          <Trans>Edit Site</Trans>
        </Heading>
      </div>

      {error && (
        <div className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Information */}
        <FieldGroup>
          <Field>
            <Label>
              <Trans>Customer</Trans> *
            </Label>
            <Select
              name="customer_id"
              required
              value={formData.customer_id || ""}
              onChange={(e) => updateField("customer_id", e.target.value)}
            >
              <option value="">{_(msg`Select customer...`)}</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.customer_number} - {customer.name}
                </option>
              ))}
            </Select>
            {fieldErrors.customer_id && (
              <Description className="text-red-600 dark:text-red-400">
                {fieldErrors.customer_id.join(", ")}
              </Description>
            )}
          </Field>

          <Field>
            <Label>
              <Trans>Organizational Unit</Trans> *
            </Label>
            <Select
              name="organizational_unit_id"
              required
              value={formData.organizational_unit_id || ""}
              onChange={(e) =>
                updateField("organizational_unit_id", e.target.value)
              }
            >
              <option value="">{_(msg`Select organizational unit...`)}</option>
              {orgUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </Select>
            {fieldErrors.organizational_unit_id && (
              <Description className="text-red-600 dark:text-red-400">
                {fieldErrors.organizational_unit_id.join(", ")}
              </Description>
            )}
          </Field>

          <Field>
            <Label>
              <Trans>Site Name</Trans> *
            </Label>
            <Input
              name="name"
              type="text"
              required
              value={formData.name || ""}
              onChange={(e) => updateField("name", e.target.value)}
            />
            {fieldErrors.name && (
              <Description className="text-red-600 dark:text-red-400">
                {fieldErrors.name.join(", ")}
              </Description>
            )}
          </Field>

          <Field>
            <Label>
              <Trans>Type</Trans> *
            </Label>
            <Select
              name="type"
              required
              value={formData.type || "permanent"}
              onChange={(e) => updateField("type", e.target.value as SiteType)}
            >
              <option value="permanent">
                <Trans>Permanent</Trans>
              </option>
              <option value="temporary">
                <Trans>Temporary</Trans>
              </option>
            </Select>
          </Field>
        </FieldGroup>

        {/* Address */}
        <div>
          <Heading level={2} className="mb-4">
            <Trans>Address</Trans>
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
                value={formData.address?.street || ""}
                onChange={(e) => updateAddress("street", e.target.value)}
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
                value={formData.address?.city || ""}
                onChange={(e) => updateAddress("city", e.target.value)}
              />
            </Field>

            <Field>
              <Label>
                <Trans>Postal Code</Trans> *
              </Label>
              <Input
                name="postal_code"
                type="text"
                required
                autoComplete="postal-code"
                value={formData.address?.postal_code || ""}
                onChange={(e) => updateAddress("postal_code", e.target.value)}
              />
            </Field>

            <Field>
              <Label>
                <Trans>Country</Trans> *
              </Label>
              <Select
                name="country"
                required
                value={formData.address?.country || "DE"}
                onChange={(e) => updateAddress("country", e.target.value)}
              >
                <option value="DE">Deutschland</option>
                <option value="AT">Österreich</option>
                <option value="CH">Schweiz</option>
              </Select>
            </Field>
          </FieldGroup>
        </div>

        {/* Contact Person */}
        <div>
          <Heading level={2} className="mb-4">
            <Trans>Contact Person</Trans>{" "}
            <span className="text-zinc-500">(Optional)</span>
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

        {/* Validity Period */}
        <div>
          <Heading level={2} className="mb-4">
            <Trans>Validity Period</Trans>{" "}
            <span className="text-zinc-500">(Optional)</span>
          </Heading>
          <FieldGroup>
            <Field>
              <Label>
                <Trans>Valid From</Trans>
              </Label>
              <Input
                name="valid_from"
                type="date"
                value={formData.valid_from || ""}
                onChange={(e) => updateField("valid_from", e.target.value)}
              />
            </Field>

            <Field>
              <Label>
                <Trans>Valid Until</Trans>
              </Label>
              <Input
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
          <Label>
            <Trans>Access Instructions</Trans>
          </Label>
          <Textarea
            name="access_instructions"
            rows={4}
            value={formData.access_instructions || ""}
            onChange={(e) => updateField("access_instructions", e.target.value)}
          />
        </Field>

        {/* Notes */}
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

        {/* Active Status */}
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
        <div className="flex gap-4 pt-4 border-t">
          <Button type="submit" disabled={saving}>
            {saving ? <Trans>Saving...</Trans> : <Trans>Save Changes</Trans>}
          </Button>
          <Button href={`/sites/${id}`} outline>
            <Trans>Cancel</Trans>
          </Button>
        </div>
      </form>
    </div>
  );
}
