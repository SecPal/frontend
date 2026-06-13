// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Site Detail Page
 * Epic #210 - Customer & Site Management
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { msg } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useLingui } from "@lingui/react";
import { ArrowLeft, Edit, List, Trash2 } from "lucide-react";
import { LoadingRegion, SectionSkeleton, Skeleton } from "@/ui";
import { getSite, deleteSite, getCustomer } from "../../services/customersApi";
import { getOrganizationalUnit } from "../../services/organizationalUnitApi";
import type { Site, Customer } from "../../types/customers";
import type { OrganizationalUnit } from "../../types/organizational";
import {
  DescriptionList,
  DescriptionDetails,
  DescriptionTerm,
  Alert,
  AlertDescription,
  Button,
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  LinkButton,
  PageLink,
  PageText,
  PageTitle,
  StatusBadge,
} from "../CustomerSites/ui";
import { formatDate } from "../../lib/dateUtils";
import { isSafeMailtoTarget, isSafeTelTarget } from "../../utils/safeUrl";
import { useUserCapabilities } from "../../hooks/useUserCapabilities";

export default function SiteDetail() {
  const { _, i18n } = useLingui();
  const capabilities = useUserCapabilities();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [site, setSite] = useState<Site | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [orgUnit, setOrgUnit] = useState<OrganizationalUnit | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    async function loadData() {
      if (!id) return;
      setLoading(true);
      setLoadError(null);
      setSite(null);
      setCustomer(null);
      setOrgUnit(null);
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
        setLoadError(
          err instanceof Error ? err.message : _(msg`Failed to load site`)
        );
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [_, id]);

  async function handleDelete() {
    if (!site) return;

    setDeleting(true);
    setDeleteError(null);

    try {
      await deleteSite(site.id);
      navigate("/sites");
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : _(msg`Failed to delete site`)
      );
      setDeleting(false);
      // Keep dialog open to show error message
    }
  }

  const isInitialLoading = loading && site === null;
  const isAssociationLoading = loading && site !== null;

  if (isInitialLoading) {
    return (
      <div className="max-w-4xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <PageTitle>
              <Trans>Site</Trans>
            </PageTitle>
            <Skeleton className="mt-3 h-4 w-40" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-6 w-20" />
          </div>
        </div>
        <div className="space-y-8">
          <SectionSkeleton
            loadingLabel={_(msg`Loading site details`)}
            rows={4}
          />
          <SectionSkeleton
            loadingLabel={_(msg`Loading site details`)}
            rows={3}
            decorative
          />
          <SectionSkeleton
            loadingLabel={_(msg`Loading site details`)}
            rows={4}
            decorative
          />
          <div className="flex gap-4 border-t pt-4">
            <Skeleton className="h-10 w-20" />
            <Skeleton className="h-10 w-24" />
            <LinkButton to="/sites" variant="outline">
              <List className="size-4" aria-hidden="true" />
              <Trans>Back to List</Trans>
            </LinkButton>
          </div>
        </div>
      </div>
    );
  }

  if (loadError || !site) {
    return (
      <div className="text-center py-12">
        <PageText className="text-red-600 dark:text-red-400">
          {loadError || <Trans>Site not found</Trans>}
        </PageText>
        <LinkButton to="/sites" variant="outline" className="mt-4">
          <ArrowLeft className="size-4" aria-hidden="true" />
          <Trans>Back to Sites</Trans>
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <PageTitle>{site.name}</PageTitle>
          <PageText className="mt-1 text-zinc-500 dark:text-zinc-400">
            {site.site_number}
          </PageText>
        </div>
        <div className="flex gap-2">
          <StatusBadge color={site.type === "permanent" ? "blue" : "amber"}>
            {site.type === "permanent" ? (
              <Trans>Permanent</Trans>
            ) : (
              <Trans>Temporary</Trans>
            )}
          </StatusBadge>
          <StatusBadge color={site.is_active ? "lime" : "zinc"}>
            {site.is_active ? <Trans>Active</Trans> : <Trans>Inactive</Trans>}
          </StatusBadge>
          {site.is_expired && (
            <StatusBadge color="red">
              <Trans>Expired</Trans>
            </StatusBadge>
          )}
        </div>
      </div>

      <div className="space-y-8">
        {/* Address */}
        <div>
          <PageTitle level={2} className="mb-4">
            <Trans>Address</Trans>
          </PageTitle>
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
            <PageTitle level={2} className="mb-4">
              <Trans>Contact Person</Trans>
            </PageTitle>
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
                    {isSafeMailtoTarget(site.contact.email) ? (
                      <PageLink to={`mailto:${site.contact.email}`}>
                        {site.contact.email}
                      </PageLink>
                    ) : (
                      site.contact.email
                    )}
                  </DescriptionDetails>
                </>
              )}

              {site.contact.phone && (
                <>
                  <DescriptionTerm>
                    <Trans>Phone</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {isSafeTelTarget(site.contact.phone) ? (
                      <PageLink to={`tel:${site.contact.phone}`}>
                        {site.contact.phone}
                      </PageLink>
                    ) : (
                      site.contact.phone
                    )}
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
            <PageTitle level={2} className="mb-4">
              <Trans>Validity Period</Trans>
            </PageTitle>
            <DescriptionList>
              {site.valid_from && (
                <>
                  <DescriptionTerm>
                    <Trans>Valid From</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {formatDate(site.valid_from, i18n.locale)}
                  </DescriptionDetails>
                </>
              )}

              {site.valid_until && (
                <>
                  <DescriptionTerm>
                    <Trans>Valid Until</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {formatDate(site.valid_until, i18n.locale)}
                  </DescriptionDetails>
                </>
              )}
            </DescriptionList>
          </div>
        )}

        {/* Access Instructions */}
        {site.access_instructions && (
          <div>
            <PageTitle level={2} className="mb-4">
              <Trans>Access Instructions</Trans>
            </PageTitle>
            <PageText className="whitespace-pre-wrap">
              {site.access_instructions}
            </PageText>
          </div>
        )}

        {/* Notes */}
        {site.notes && (
          <div>
            <PageTitle level={2} className="mb-4">
              <Trans>Notes</Trans>
            </PageTitle>
            <PageText className="whitespace-pre-wrap">{site.notes}</PageText>
          </div>
        )}

        {/* Metadata */}
        <div>
          <PageTitle level={2} className="mb-4">
            <Trans>Details</Trans>
          </PageTitle>
          <LoadingRegion
            loading={isAssociationLoading}
            loadingLabel={_(msg`Loading site lookup data`)}
          >
            <DescriptionList>
              <DescriptionTerm>
                <Trans>Customer</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                {customer ? (
                  <PageLink to={`/customers/${site.customer_id}`}>
                    {customer.name}
                  </PageLink>
                ) : isAssociationLoading ? (
                  <Skeleton className="h-4 w-40" />
                ) : (
                  site.customer_id
                )}
              </DescriptionDetails>

              <DescriptionTerm>
                <Trans>Organizational Unit</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                {orgUnit ? (
                  orgUnit.name
                ) : isAssociationLoading ? (
                  <Skeleton className="h-4 w-40" />
                ) : (
                  site.organizational_unit_id
                )}
              </DescriptionDetails>

              <DescriptionTerm>
                <Trans>Created</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                {formatDate(site.created_at, i18n.locale)}
              </DescriptionDetails>

              <DescriptionTerm>
                <Trans>Last Updated</Trans>
              </DescriptionTerm>
              <DescriptionDetails>
                {formatDate(site.updated_at, i18n.locale)}
              </DescriptionDetails>
            </DescriptionList>
          </LoadingRegion>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t">
          {capabilities.actions.sites.update && (
            <LinkButton to={`/sites/${site.id}/edit`}>
              <Edit className="size-4" aria-hidden="true" />
              <Trans>Edit</Trans>
            </LinkButton>
          )}
          {capabilities.actions.sites.delete && (
            <Button
              variant="outline"
              onClick={() => {
                setDeleteError(null);
                setShowDeleteDialog(true);
              }}
              disabled={deleting}
            >
              <Trash2 className="size-4" aria-hidden="true" />
              <Trans>Delete</Trans>
            </Button>
          )}
          <LinkButton to="/sites" variant="outline">
            <List className="size-4" aria-hidden="true" />
            <Trans>Back to List</Trans>
          </LinkButton>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {capabilities.actions.sites.delete && (
        <Dialog
          open={showDeleteDialog}
          onClose={() => setShowDeleteDialog(false)}
        >
          <DialogPortal>
            <DialogOverlay />
            <DialogContent>
              <DialogTitle>
                <Trans>Delete Site</Trans>
              </DialogTitle>
              <DialogDescription>
                <Trans>
                  Are you sure you want to delete this site? This action cannot
                  be undone.
                </Trans>
              </DialogDescription>
              <DialogBody>
                {deleteError !== null && (
                  <Alert className="mb-4 border-red-200 bg-red-50 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
                    <AlertDescription>{deleteError}</AlertDescription>
                  </Alert>
                )}
                <PageText>
                  <Trans>Site:</Trans> <strong>{site.name}</strong>
                </PageText>
                <PageText>
                  <Trans>Site Number:</Trans>{" "}
                  <strong>{site.site_number}</strong>
                </PageText>
              </DialogBody>
              <DialogActions>
                <Button
                  variant="ghost"
                  onClick={() => setShowDeleteDialog(false)}
                >
                  <Trans>Cancel</Trans>
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={deleting}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                  {deleting ? (
                    <Trans>Deleting...</Trans>
                  ) : (
                    <Trans>Delete</Trans>
                  )}
                </Button>
              </DialogActions>
            </DialogContent>
          </DialogPortal>
        </Dialog>
      )}
    </div>
  );
}
