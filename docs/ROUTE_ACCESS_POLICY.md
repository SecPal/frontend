<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# Route Access Policy

This document defines the frontend route behavior for authenticated users outside the onboarding flow.

## Policy Summary

- Self-service routes remain visible and directly accessible to any authenticated user: `/`, `/about`, `/profile`, `/settings`, `/onboarding`.
- Top-level management features that the user cannot discover in the UI must behave like unknown app routes and resolve to the shared in-app `Page Not Found` state.
- Routes inside a feature the user can already discover may still return `Access Denied` when the user lacks the specific create or update capability for that action.
- Legacy aliases should redirect to the canonical route once the user is authorized for the underlying feature.

## Route Groups

| Route group                                                                                                                             | When feature is unknown to the user                       | When feature is known but action is forbidden                   | Authorized behavior                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `/`, `/about`, `/profile`, `/settings`, `/onboarding`                                                                                   | Visible                                                   | Not applicable                                                  | Render normally                                                                        |
| `/organization`, `/organizational-units`                                                                                                | `Page Not Found`                                          | Not applicable                                                  | `/organization` renders normally, `/organizational-units` redirects to `/organization` |
| `/customers`, `/customers/:id`, `/sites`, `/sites/customer/:customerId`, `/sites/:id`, `/employees`, `/employees/:id`, `/activity-logs` | `Page Not Found`                                          | Not applicable                                                  | Render normally                                                                        |
| `/customers/new`, `/customers/:id/edit`                                                                                                 | `Page Not Found` if the whole customer feature is unknown | `Access Denied` without redirect if create or update is missing | Render normally                                                                        |
| `/sites/new`, `/sites/new/customer/:customerId`, `/sites/:id/edit`                                                                      | `Page Not Found` if the whole site feature is unknown     | `Access Denied` without redirect if create or update is missing | Render normally                                                                        |
| `/employees/create`, `/employees/:id/edit`                                                                                              | `Page Not Found` if the whole employee feature is unknown | `Access Denied` without redirect if create or update is missing | Render normally                                                                        |
| Any other authenticated app route, for example `/roles` or `/permissions`                                                               | `Page Not Found`                                          | Not applicable                                                  | Not applicable                                                                         |

## Rationale

- `Page Not Found` is used when the product does not expose that area to the current user at all.
- `Access Denied` is reserved for routes inside an area the user can already discover, so the denial communicates a missing action-level capability instead of implying the page never existed.
