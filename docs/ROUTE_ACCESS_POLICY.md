<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Route Access Policy

The authenticated app uses two states to explain unavailable destinations.

- **Page Not Found** is the shared state for unknown routes and management
  features the current user cannot discover.
- **Access Denied** tells users they lack permission for a specific action in
  a feature they can already discover.

The [authenticated router](../src/AuthenticatedApp.tsx) and
[route tests](../src/App.test.tsx) define the current routes and redirects.
The API enforces access to data and actions. See its
[authorization documentation](https://github.com/SecPal/api/blob/main/docs/rbac-architecture.md)
and the [published OpenAPI contract](https://github.com/SecPal/contracts/blob/main/docs/openapi.yaml).
