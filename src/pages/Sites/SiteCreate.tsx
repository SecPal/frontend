// SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Site Create Page
 * Epic #210 - Customer & Site Management
 */

import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { Button } from "@/ui/button";
import { Input } from "@/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/ui/select";
import { AddressAutocompleteFields } from "@/components/AddressAutocompleteFields";
import { AddressCountryField } from "@/components/AddressCountryField";
import {
  emptyBusinessAddress,
  type BusinessAddressField,
} from "@/lib/businessAddress";
import { createSite } from "../../services/customersApi";
import type {
  CreateSiteRequest,
  Contact,
  SiteType,
} from "../../types/customers";
import {
  DomainAssignmentFields,
  type DomainAssignmentStatus,
} from "../../components/DomainAssignmentFields";
import {
  Alert,
  AlertDescription,
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  CustomerSiteLinkButton as LinkButton,
  CustomerSitePageTitle as PageTitle,
} from "@/ui";

export default function SiteCreate() {
  const navigate = useNavigate();
  const { _ } = useLingui();
  const { customerId } = useParams<{ customerId?: string }>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [domainStatus, setDomainStatus] =
    useState<DomainAssignmentStatus>("loading");

  const [formData, setFormData] = useState<CreateSiteRequest>({
    customer_id: customerId || "",
    legal_entity_id: "",
    establishment_id: "",
    name: "",
    type: "permanent",
    address: emptyBusinessAddress,
    is_active: true,
  });

  function updateField(field: keyof CreateSiteRequest, value: unknown) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      [field]: value,
    }));
  }

  function updateAddress(field: BusinessAddressField, value: string) {
    setFormData((currentFormData) => ({
      ...currentFormData,
      address: {
        ...currentFormData.address,
        [field]: value,
      },
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
    const domainErrors: Record<string, string[]> = {};
    if (!formData.legal_entity_id)
      domainErrors.legal_entity_id = [_(msg`Legal entity is required`)];
    if (!formData.establishment_id)
      domainErrors.establishment_id = [_(msg`Establishment is required`)];
    if (!formData.customer_id)
      domainErrors.customer_id = [_(msg`Customer is required`)];
    if (domainStatus !== "ready") {
      setFieldErrors(domainErrors);
      setError(
        domainStatus === "loading"
          ? _(msg`The domain assignment is still loading.`)
          : domainStatus === "error"
            ? _(msg`The domain assignment options could not be loaded.`)
            : _(
                msg`Select an authorized legal entity, establishment, and customer.`
              )
      );
      return;
    }
    setLoading(true);
    setError(null);
    setFieldErrors({});

    try {
      // Clean up the data before sending
      const dataToSend: CreateSiteRequest = {
        customer_id: formData.customer_id,
        legal_entity_id: formData.legal_entity_id,
        establishment_id: formData.establishment_id,
        name: formData.name,
        type: formData.type,
        address: formData.address,
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

      const site = await createSite(dataToSend);
      navigate(`/sites/${site.id}`);
    } catch (err: unknown) {
      // Parse validation errors from Laravel API
      const error = err as Error & { errors?: Record<string, string[]> };
      if (error.errors && typeof error.errors === "object") {
        setFieldErrors(error.errors);
        setError(_(msg`Please correct the errors below.`));
      } else {
        setError(error.message || _(msg`Failed to create site`));
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <PageTitle>
          <Trans>New Site</Trans>
        </PageTitle>
      </div>

      {error && (
        <Alert
          role="alert"
          className="mb-4 border-destructive/30 bg-destructive/10 text-foreground"
        >
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
            fixedCustomerId={customerId}
            onStatusChange={setDomainStatus}
            value={formData}
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
              value={formData.name}
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

          <Field>
            <FieldLabel htmlFor="site-type">
              <Trans>Type</Trans> *
            </FieldLabel>
            <Select
              name="type"
              required
              value={formData.type}
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
            <AddressAutocompleteFields
              address={formData.address}
              fieldIdPrefix="site"
              fieldNamePrefix=""
              required
              onChange={updateAddress}
              fieldErrors={{
                street: fieldErrors["address.street"]?.join(", "),
                house_number: fieldErrors["address.house_number"]?.join(", "),
                postal_code: fieldErrors["address.postal_code"]?.join(", "),
                city: fieldErrors["address.city"]?.join(", "),
              }}
            />

            <AddressCountryField
              name="country"
              value={formData.address.country}
              required
              errorMessage={fieldErrors["address.country"]?.join(", ")}
              onChange={(country) => updateAddress("country", country)}
            />
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
                aria-invalid={fieldErrors["contact.name"] ? true : undefined}
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
                aria-invalid={fieldErrors["contact.email"] ? true : undefined}
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
                aria-invalid={fieldErrors["contact.phone"] ? true : undefined}
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
          <Button
            type="submit"
            disabled={loading || domainStatus === "loading"}
          >
            {loading ? <Trans>Creating...</Trans> : <Trans>Create Site</Trans>}
          </Button>
          <LinkButton to="/sites" variant="outline">
            <Trans>Cancel</Trans>
          </LinkButton>
        </div>
      </form>
    </div>
  );
}
