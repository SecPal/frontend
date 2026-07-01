<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Canonical shadcn/Radix/Lucide Layer

`src/ui` is the canonical app UI layer for production surfaces. It owns the
common zinc/blue SecPal tokens, rounded `md` controls, focus rings, dark-mode
classes, Radix-backed interactive primitives, shell composition, Lucide icon
composition, and the canonical `cn` export from `@/lib/utils`.

The shadcn project metadata lives in `components.json`. It pins the `new-york`
style, TypeScript React output, Tailwind v4 CSS entry at `src/index.css`, the
`zinc` base color, Lucide icons, and aliases that route generated or manually
ported primitives to `@/ui`, `@/components`, `@/lib`, `@/hooks`, and
`@/lib/utils`.

Usage rules:

- Prefer `src/ui` for new shared primitive work: `Button`, `Input`, `Textarea`,
  `Select*`, `Command*`, `Checkbox`, `RadioGroup*`, `Dialog*`, `Alert*`,
  `Card*`, `Badge`, `Progress`, and `Field*`.
- Keep route-specific composition helpers in `src/ui` behind explicit names
  such as `Login*`, `Onboarding*`, `CustomerSite*`, and `Employee*` when a
  route needs explicit feature composition or names that must stay distinct
  from canonical shared primitives.
- Do not import old shared UI wrappers from `src/components/*`, and do not
  reintroduce route-local primitive barrels or shared compatibility aliases.
  The boundary tests cover production source imports, route scopes, and the
  shared UI layer.
- Primitives must not provide English user-facing fallback copy for labels,
  placeholders, loading labels, empty states, or error messages. Pass localized
  route-owned copy at the call site.

## Final Architecture

`tests/legacy-ui-guardrails.test.ts` expects zero remaining non-canonical UI
layers in production code. Deprecated generic UI wrappers under
`src/components/*`, route-local UI barrels such as `src/pages/*/ui`, and shared
compatibility exports that imitate old shell/dropdown names are blocked from
returning.

Canonical shell primitives such as `Sidebar*`, `Sheet*`, `DropdownMenu*`, and
`Navbar*` remain in `src/ui` under their shadcn/Radix names. Feature-specific
helpers remain explicit and prefixed so they cannot be confused with canonical
shared primitives.

## Loading Contract

Use shared loading primitives from `src/ui` for all production surfaces:

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

## Route And Data Prefetching

Use the shared route prefetch strategy from `src/hooks/usePrefetch.ts` for app
navigation warmups:

- Route components must be loaded through `src/routeModules.ts` so
  `React.lazy` and prefetch use the same dynamic import function.
- Authenticated shell navigation should idle-prefetch route chunks for visible
  primary destinations. Keep this capability-gated so users do not prefetch
  areas they cannot discover, and do not run idle API prefetches from the shell
  because auth bootstrap and E2E `networkidle` waits must stay stable.
- High-frequency internal links should use `PrefetchLink` directly or the
  prefixed shared `CustomerSite*` / `Employee*` link helpers in `@/ui`. The
  shared link triggers route and API warmup on hover, focus, and touch intent.
- Add route plans for predictable list and detail destinations in
  `getRoutePrefetchPlan`. Include API GET paths only when they match the data
  the destination page will request on first render.
- Prefetch is best-effort and must not block navigation or surface errors to
  users. Failures are swallowed after optional development logging.
- Regression coverage lives in the prefetch unit tests and the Playwright smoke
  test that verifies warmed customer navigation does not show the full
  application route loader.
