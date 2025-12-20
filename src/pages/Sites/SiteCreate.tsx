// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Site Create Page
 * Epic #210 - Customer & Site Management
 */

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Trans, msg } from "@lingui/macro";
import { useLingui } from "@lingui/react";
import { createSite, listCustomers } from "../../services/customersApi";
import { listOrganizationalUnits } from "../../lib/organizationalUnitStore";
import type {
  CreateSiteRequest,
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

export default function SiteCreate() {
  const navigate = useNavigate();
  const { _ } = useLingui();
  const { customerId } = useParams<{ customerId?: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orgUnits, setOrgUnits] = useState<OrganizationalUnitCacheEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  const [formData, setFormData] = useState<CreateSiteRequest>({
    customer_id: customerId || "",
    organizational_unit_id: "",
    name: "",
    type: "permanent",
    address: {
      street: "",
      city: "",
      postal_code: "",
      country: "DE",
    },
    is_active: true,
  });

  useEffect(() => {
    async function loadData() {
      setLoadingData(true);
      try {
        const [customersData, orgUnitsData] = await Promise.all([
          listCustomers({ per_page: 100 }),
          listOrganizationalUnits(),
        ]);
        setCustomers(customersData.data);
        setOrgUnits(orgUnitsData);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load required data"
        );
      } finally {
        setLoadingData(false);
      }
    }
    loadData();
  }, []);

  function updateField(field: keyof CreateSiteRequest, value: unknown) {
    setFormData({ ...formData, [field]: value });
  }

  function updateAddress(field: keyof Address, value: string) {
    setFormData({
      ...formData,
      address: { ...formData.address, [field]: value },
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
      const dataToSend: CreateSiteRequest = {
        customer_id: formData.customer_id,
        organizational_unit_id: formData.organizational_unit_id,
        name: formData.name,
        type: formData.type,
        address: formData.address,
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

      // Only include optional text fields if not empty
      if (formData.access_instructions?.trim()) {
        dataToSend.access_instructions = formData.access_instructions;
      }
      if (formData.notes?.trim()) {
        dataToSend.notes = formData.notes;
      }

      // Include validity dates if set
      if (formData.valid_from) {
        dataToSend.valid_from = formData.valid_from;
      }
      if (formData.valid_until) {
        dataToSend.valid_until = formData.valid_until;
      }

      const site = await createSite(dataToSend);
      navigate(`/sites/${site.id}`);
    } catch (err: unknown) {
      // Parse validation errors from Laravel API
      const error = err as Error & { errors?: Record<string, string[]> };
      if (error.errors && typeof error.errors === "object") {
        setFieldErrors(error.errors);
        setError("Please correct the errors below.");
      } else {
        setError(error.message || "Failed to create site");
      }
    } finally {
      setLoading(false);
    }
  }

  if (loadingData) {
    return (
      <div className="text-center py-12">
        <Trans>Loading...</Trans>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <Heading>
          <Trans>New Site</Trans>
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
              value={formData.customer_id}
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
              value={formData.organizational_unit_id}
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
              value={formData.name}
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
              value={formData.type}
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
                value={formData.address.street}
                onChange={(e) => updateAddress("street", e.target.value)}
              />
              {fieldErrors["address.street"] && (
                <Description className="text-red-600 dark:text-red-400">
                  {fieldErrors["address.street"].join(", ")}
                </Description>
              )}
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
                value={formData.address.city}
                onChange={(e) => updateAddress("city", e.target.value)}
              />
              {fieldErrors["address.city"] && (
                <Description className="text-red-600 dark:text-red-400">
                  {fieldErrors["address.city"].join(", ")}
                </Description>
              )}
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
                value={formData.address.postal_code}
                onChange={(e) => updateAddress("postal_code", e.target.value)}
              />
              {fieldErrors["address.postal_code"] && (
                <Description className="text-red-600 dark:text-red-400">
                  {fieldErrors["address.postal_code"].join(", ")}
                </Description>
              )}
            </Field>

            <Field>
              <Label>
                <Trans>Country</Trans> *
              </Label>
              <Select
                name="country"
                required
                value={formData.address.country}
                onChange={(e) => updateAddress("country", e.target.value)}
              >
                <option value="DE">Deutschland</option>
                <option value="AT">Österreich</option>
                <option value="CH">Schweiz</option>
              </Select>
              {fieldErrors["address.country"] && (
                <Description className="text-red-600 dark:text-red-400">
                  {fieldErrors["address.country"].join(", ")}
                </Description>
              )}
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
          <Button type="submit" disabled={loading}>
            {loading ? <Trans>Creating...</Trans> : <Trans>Create Site</Trans>}
          </Button>
          <Button href="/sites" outline>
            <Trans>Cancel</Trans>
          </Button>
        </div>
      </form>
    </div>
  );
}
