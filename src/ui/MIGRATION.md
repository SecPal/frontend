<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Shared shadcn/Radix UI Basis

`src/ui` is the shared app UI layer for migrated surfaces. It owns the common
zinc/blue SecPal tokens, rounded `md` controls, focus rings, dark-mode classes,
Radix-backed interactive primitives, and the canonical `cn` export from
`@/lib/utils`.

Migration rules:

- Prefer `src/ui` for new shared primitive work: `Button`, `Input`, `Textarea`,
  `Select*`, `Checkbox`, `RadioGroup*`, `Dialog*`, `Alert*`, `Card*`, `Badge`,
  `Progress`, and `Field*`.
- Keep route-local barrels such as `src/pages/Auth/ui` and
  `src/pages/Onboarding/ui` as the public compatibility surface while a route
  still needs prefixed slots, route-specific helpers, or legacy-compatible
  event shapes.
- Do not import old Catalyst/Tailwind Plus wrappers from `src/components/*` in
  migrated Auth or Onboarding code. The migration boundary test covers this
  route scope and the shared UI layer.
- Primitives must not provide English user-facing fallback copy for labels,
  placeholders, loading labels, empty states, or error messages. Pass localized
  route-owned copy at the call site.
