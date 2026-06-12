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
- Do not import old shared UI wrappers from `src/components/*` in migrated Auth
  or Onboarding code. The migration boundary test covers this route scope and
  the shared UI layer.
- Primitives must not provide English user-facing fallback copy for labels,
  placeholders, loading labels, empty states, or error messages. Pass localized
  route-owned copy at the call site.

## Loading Contract

Use shared loading primitives from `src/ui` for all new or migrated surfaces:

- Use `Skeleton` for decorative placeholder shapes. It is hidden from assistive
  technology by default, so pair it with a labeled status container when it is
  the only visible loading feedback.
- Use `PageSkeleton`, `SectionSkeleton`, `TableSkeleton`, or `FormSkeleton`
  when no useful data has loaded yet and the page can predict the structure
  that will appear. Pass a localized `loadingLabel` from the route or feature.
- Use `LoadingRegion` for non-blocking refreshes after data is already visible.
  Keep the existing rows, cards, or form values rendered, set the region busy,
  and expose localized refresh text through `loadingLabel`.
- Use a full blocking state only when the user cannot safely interact with the
  surface yet, such as auth/session bootstrap, first-load route guards, or a
  mutation that must prevent duplicate submission.
- Use `Spinner` only for action-sized indeterminate work where a skeleton cannot
  describe the future layout, such as an icon inside a disabled submit button or
  a short-lived route chunk loader. Page, section, and table loads should use
  skeleton placeholders instead of ad-hoc `Loading...` text or custom spinners.
- During background refresh, already-loaded data must stay visible. Do not swap
  a populated table, list, card group, or form back to a full-page loader unless
  the loaded data is no longer valid to show.
