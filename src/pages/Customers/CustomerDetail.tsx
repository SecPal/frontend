// SPDX-FileCopyrightText: 2025 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Customer Detail Page
 * Epic #210 - Customer & Site Management
 */

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Trans } from "@lingui/macro";
import { getCustomer, deleteCustomer } from "../../services/customersApi";
import type { Customer } from "../../types/customers";
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

export default function CustomerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    async function loadCustomer() {
      if (!id) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getCustomer(id);
        setCustomer(data);
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

  async function handleDelete() {
    if (!customer) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteCustomer(customer.id);
      navigate("/customers");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete customer"
      );
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

  if (error || !customer) {
    return (
      <div className="text-center py-12">
        <Text className="text-red-600">
          {error || <Trans>Customer not found</Trans>}
        </Text>
        <Button href="/customers" outline className="mt-4">
          <Trans>Back to Customers</Trans>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <Heading>{customer.name}</Heading>
          <Text className="mt-1 text-zinc-500">{customer.customer_number}</Text>
        </div>
        <div className="flex gap-2">
          <Badge color={customer.is_active ? "lime" : "zinc"}>
            {customer.is_active ? (
              <Trans>Active</Trans>
            ) : (
              <Trans>Inactive</Trans>
            )}
          </Badge>
        </div>
      </div>

      <div className="space-y-8">
        {/* Billing Address */}
        <div>
          <Heading level={2} className="mb-4">
            <Trans>Billing Address</Trans>
          </Heading>
          <DescriptionList>
            <DescriptionTerm>
              <Trans>Street</Trans>
            </DescriptionTerm>
            <DescriptionDetails>
              {customer.billing_address.street}
            </DescriptionDetails>

            <DescriptionTerm>
              <Trans>City</Trans>
            </DescriptionTerm>
            <DescriptionDetails>
              {customer.billing_address.postal_code}{" "}
              {customer.billing_address.city}
            </DescriptionDetails>

            <DescriptionTerm>
              <Trans>Country</Trans>
            </DescriptionTerm>
            <DescriptionDetails>
              {customer.billing_address.country}
            </DescriptionDetails>
          </DescriptionList>
        </div>

        {/* Contact Information */}
        {customer.contact && (
          <div>
            <Heading level={2} className="mb-4">
              <Trans>Contact Person</Trans>
            </Heading>
            <DescriptionList>
              {customer.contact.name && (
                <>
                  <DescriptionTerm>
                    <Trans>Name</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    {customer.contact.name}
                  </DescriptionDetails>
                </>
              )}

              {customer.contact.email && (
                <>
                  <DescriptionTerm>
                    <Trans>Email</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    <a
                      href={`mailto:${customer.contact.email}`}
                      className="text-blue-600 hover:underline"
                    >
                      {customer.contact.email}
                    </a>
                  </DescriptionDetails>
                </>
              )}

              {customer.contact.phone && (
                <>
                  <DescriptionTerm>
                    <Trans>Phone</Trans>
                  </DescriptionTerm>
                  <DescriptionDetails>
                    <a
                      href={`tel:${customer.contact.phone}`}
                      className="text-blue-600 hover:underline"
                    >
                      {customer.contact.phone}
                    </a>
                  </DescriptionDetails>
                </>
              )}
            </DescriptionList>
          </div>
        )}

        {/* Notes */}
        {customer.notes && (
          <div>
            <Heading level={2} className="mb-4">
              <Trans>Notes</Trans>
            </Heading>
            <Text className="whitespace-pre-wrap">{customer.notes}</Text>
          </div>
        )}

        {/* Sites */}
        <div>
          <Heading level={2} className="mb-4">
            <Trans>Sites</Trans>
          </Heading>
          <Text className="mb-4">
            <Trans>
              This customer has {customer.sites_count || 0} site(s).
            </Trans>
          </Text>
          <Button href={`/sites?customer_id=${customer.id}`} outline>
            <Trans>View Sites</Trans>
          </Button>
        </div>

        {/* Actions */}
        <div className="flex gap-4 pt-4 border-t">
          <Button href={`/customers/${customer.id}/edit`}>
            <Trans>Edit</Trans>
          </Button>
          <Button
            outline
            onClick={() => setShowDeleteDialog(true)}
            disabled={deleting}
          >
            <Trans>Delete</Trans>
          </Button>
          <Button href="/customers" outline>
            <Trans>Back to List</Trans>
          </Button>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
      >
        <DialogTitle>
          <Trans>Delete Customer</Trans>
        </DialogTitle>
        <DialogDescription>
          <Trans>
            Are you sure you want to delete "{customer.name}"? This action
            cannot be undone.
          </Trans>
        </DialogDescription>
        <DialogBody>
          {error && <Text className="text-red-600 mb-4">{error}</Text>}
        </DialogBody>
        <DialogActions>
          <Button
            plain
            onClick={() => setShowDeleteDialog(false)}
            disabled={deleting}
          >
            <Trans>Cancel</Trans>
          </Button>
          <Button color="red" onClick={handleDelete} disabled={deleting}>
            {deleting ? <Trans>Deleting...</Trans> : <Trans>Delete</Trans>}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
