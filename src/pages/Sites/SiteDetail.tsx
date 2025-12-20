// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Site Detail Page
 * Epic #210 - Customer & Site Management
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { getSite, deleteSite, getCustomer } from "../../services/customersApi";
import { getOrganizationalUnit } from "../../services/organizationalUnitApi";
import type { Site, Customer } from "../../types/customers";
import type { OrganizationalUnit } from "../../types/organizational";
import { Heading } from "../../components/heading";
import { Button } from "../../components/button";
import { Text } from "../../components/text";
import { Badge } from "../../components/badge";
import {
  DescriptionList,
  DescriptionTerm,
  DescriptionDetails,
} from "../../components/description-list";
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from "../../components/dialog";

export default function SiteDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orgUnit, setOrgUnit] = useState<OrganizationalUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const siteData = await getSite(id);
        setSite(siteData);
        
        // Load customer and org unit in parallel, but don't fail if they error
        const [customerResult, orgUnitResult] = await Promise.allSettled([
          getCustomer(siteData.customer_id),
          getOrganizationalUnit(siteData.organizational_unit_id),
        ]);
        
        if (customerResult.status === "fulfilled") {
          setCustomer(customerResult.value);
        }
        if (orgUnitResult.status === "fulfilled") {
          setOrgUnit(orgUnitResult.value);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load site");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [id]);

  async function handleDelete() {
    if (!site) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteSite(site.id);
      navigate("/sites");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete site");
      setDeleting(false);
      // Keep dialog open to show error message
    }
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <Trans>Loading...</Trans>
      </div>
    );
  }

  if (error || !site) {
    return (
      <div className="text-center py-12">
        <Text className="text-red-600 dark:text-red-400">
          {error || <Trans>Site not found</Trans>}
        </Text>
        <Button href="/sites" outline className="mt-4">
          <Trans>Back to Sites</Trans>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Heading>{site.name}</Heading>
          <Text className="mt-1 text-zinc-500 dark:text-zinc-400">
            {site.site_number}
          </Text>
        </div>
        <div className="flex gap-2">
          <Badge color={site.type === "permanent" ? "blue" : "amber"}>
            {site.type === "permanent" ? (
              <Trans>Permanent</Trans>
            ) : (
              <Trans>Temporary</Trans>
            )}
          </Badge>
          <Badge color={site.is_active ? "lime" : "zinc"}>
            {site.is_active ? <Trans>Active</Trans> : <Trans>Inactive</Trans>}
          </Badge>
          {site.is_expired && (
            <Badge color="red">
              <Trans>Expired</Trans>
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {/* Address */}
        <div>
          <Heading level={2} className="mb-4">
            <Trans>Address</Trans>
          </Heading>
          <DescriptionList>
            <DescriptionTerm>
              <Trans>Street</Trans>
            </DescriptionTerm>
            <DescriptionDetails>{site.address.street}</DescriptionDetails>

            <DescriptionTerm>
              <Trans>City</Trans>
            </DescriptionTerm>
            <DescriptionDetails>
              {site.address.postal_code} {site.address.city}
            </DescriptionDetails>

            <DescriptionTerm>
              <Trans>Country</Trans>
            </DescriptionTerm>
            <DescriptionDetails>{site.address.country}</DescriptionDetails>

            {(site.address.latitude || site.address.longitude) && (
              <>
                <DescriptionTerm>
                  <Trans>Coordinates</Trans>
                </DescriptionTerm>
                <DescriptionDetails>
                  {site.address.latitude}, {site.address.longitude}
                </DescriptionDetails>
              </>
            )}
          </DescriptionList>
        </div>

        {/* Contact Information */}
        {site.contact && (
          <div>
            <Heading level={2} className="mb-4">
              <Trans>Contact Person</Trans>
            </Heading>
            <DescriptionList>
              <DescriptionTerm>
                <Trans>Name</Trans>
              </DescriptionTerm>
              <DescriptionDetails>{site.contact.name}</DescriptionDetails>

              {site.contact.email && (
                <>
                  <DescriptionTerm>
                    <Trans>Email</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    <a
                      href={`mailto:${site.contact.email}`}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {site.contact.email}
                    </a>
                  </DescriptionDetails>
                </>
              )}

              {site.contact.phone && (
                <>
                  <DescriptionTerm>
                    <Trans>Phone</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    <a
                      href={`tel:${site.contact.phone}`}
                      className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
                    >
                      {site.contact.phone}
                    </a>
                  </DescriptionDetails>
                </>
              )}

              {site.contact.position && (
                <>
                  <DescriptionTerm>
                    <Trans>Position</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {site.contact.position}
                  </DescriptionDetails>
                </>
              )}
            </DescriptionList>
          </div>
        )}

        {/* Validity Period */}
        {(site.valid_from || site.valid_until) && (
          <div>
            <Heading level={2} className="mb-4">
              <Trans>Validity Period</Trans>
            </Heading>
            <DescriptionList>
              {site.valid_from && (
                <>
                  <DescriptionTerm>
                    <Trans>Valid From</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {new Date(site.valid_from).toLocaleDateString()}
                  </DescriptionDetails>
                </>
              )}

              {site.valid_until && (
                <>
                  <DescriptionTerm>
                    <Trans>Valid Until</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {new Date(site.valid_until).toLocaleDateString()}
                  </DescriptionDetails>
                </>
              )}
            </DescriptionList>
          </div>
        )}

        {/* Access Instructions */}
        {site.access_instructions && (
          <div>
            <Heading level={2} className="mb-4">
              <Trans>Access Instructions</Trans>
            </Heading>
            <Text className="whitespace-pre-wrap">
              {site.access_instructions}
            </Text>
          </div>
        )}

        {/* Notes */}
        {site.notes && (
          <div>
            <Heading level={2} className="mb-4">
              <Trans>Notes</Trans>
            </Heading>
            <Text className="whitespace-pre-wrap">{site.notes}</Text>
          </div>
        )}

        {/* Metadata */}
        <div>
          <Heading level={2} className="mb-4">
            <Trans>Details</Trans>
          </Heading>
          <DescriptionList>
            <DescriptionTerm>
              <Trans>Customer</Trans>
            </DescriptionTerm>
            <DescriptionDetails>
              {customer ? (
                <Button href={`/customers/${site.customer_id}`} plain>
                  {customer.name}
                </Button>
              ) : (
                site.customer_id
              )}
            </DescriptionDetails>

            <DescriptionTerm>
              <Trans>Organizational Unit</Trans>
            </DescriptionTerm>
            <DescriptionDetails>
              {orgUnit ? orgUnit.name : site.organizational_unit_id}
            </DescriptionDetails>

            <DescriptionTerm>
              <Trans>Created</Trans>
            </DescriptionTerm>
            <DescriptionDetails>
              {new Date(site.created_at).toLocaleString()}
            </DescriptionDetails>

            <DescriptionTerm>
              <Trans>Last Updated</Trans>
            </DescriptionTerm>
            <DescriptionDetails>
              {new Date(site.updated_at).toLocaleString()}
            </DescriptionDetails>
          </DescriptionList>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t">
          <Button href={`/sites/${site.id}/edit`}>
            <Trans>Edit</Trans>
          </Button>
          <Button
            outline
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleting}
          >
            <Trans>Delete</Trans>
          </Button>
          <Button href="/sites" outline>
            <Trans>Back to List</Trans>
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onClose={setShowDeleteDialog}>
        <DialogTitle>
          <Trans>Delete Site</Trans>
        </DialogTitle>
        <DialogDescription>
          <Trans>
            Are you sure you want to delete this site? This action cannot be
            undone.
          </Trans>
        </DialogDescription>
        <DialogBody>
          {error && (
            <div className="rounded-md bg-red-50 p-4 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-200">
              {error}
            </div>
          )}
          <Text>
            <Trans>Site:</Trans> <strong>{site.name}</strong>
          </Text>
          <Text>
            <Trans>Site Number:</Trans> <strong>{site.site_number}</strong>
          </Text>
        </DialogBody>
        <DialogActions>
          <Button outline onClick={() => setShowDeleteDialog(false)}>
            <Trans>Cancel</Trans>
          </Button>
          <Button onClick={handleDelete} disabled={deleting}>
            {deleting ? <Trans>Deleting...</Trans> : <Trans>Delete</Trans>}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
