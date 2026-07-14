<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Legal Entity Customer Migration Decision

## Status

Migration status: blocked.

Existing customers must not be backfilled to a Legal Entity until the product
team provides business approval for a deterministic assignment rule.

## Required Business Decision

The product-approved backfill rule must identify exactly one Legal Entity for
each existing customer before any data migration runs. The rule must be based
on customer records or other auditable business data, not on a catch-all
fallback.

No silent default assignment is allowed. A migration must not assign existing
customers to the first Legal Entity, the only Legal Entity in a tenant, a global
placeholder, or any other implicit default.

## Tenant Consistency

Before execution, the approved rule must prove tenant consistency:

- the selected Legal Entity belongs to the same tenant as the customer;
- every migrated customer receives a Legal Entity from its own tenant;
- customers without a provable tenant-consistent Legal Entity remain unmigrated
  and are reported for product review;
- the contracts, API, and frontend changes use the same rule and validation
  expectations.

## Tracking

The work is split across one epic with repository-specific sub-issues:

- Epic: <https://github.com/SecPal/frontend/issues/1391>
- SecPal/contracts sub-issue: <https://github.com/SecPal/contracts/issues/351>
- SecPal/api sub-issue: <https://github.com/SecPal/api/issues/1278>
- SecPal/frontend sub-issue: <https://github.com/SecPal/frontend/issues/1390>
