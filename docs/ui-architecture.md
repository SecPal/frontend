<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# UI architecture

SecPal uses shadcn/ui components built on Base UI primitives, with Tailwind CSS
for styling and Lucide for general-purpose icons. Use shared primitives such as
`Button`, `Dialog` and `Select` from [`src/ui`](../src/ui). Base UI handles
focus, keyboard interaction, portals and dismissal. Keep product compositions
identified by their feature and pass localized labels, placeholders, loading text
and errors from the calling feature.

[`components.json`](../components.json) defines the `base-vega` registry style,
zinc palette, CSS entry and aliases. Use the versioned official shadcn CLI and
Base UI registry output. Review generated diffs for behavior and design token
changes. Community registries require architecture and license review.
The [legacy UI guardrails](../tests/legacy-ui-guardrails.test.ts) reject old
shared wrappers, route-local primitive barrels and compatibility exports.
Keep general-purpose primitives and icons on the approved stack.

Use Tailwind classes, finite variants, semantic attributes and
[stylesheet tokens](../src/index.css) in application code. The static CSP
contract excludes JSX `style` props and direct `CSSStyleDeclaration` changes.
`tw-animate-css` provides transition utilities, and the shared stylesheet
reduces motion when requested. Brand assets and domain symbols outside Lucide
remain reviewed static assets.

## Loading

Use the [shared loading primitives](../src/ui/loading.tsx). On first load, use
`PageSkeleton`, `SectionSkeleton`, `TableSkeleton` or `FormSkeleton` where the
layout is known. `Skeleton` is decorative. Give a containing status a localized
label when the skeleton is the only feedback. For a safe refresh, keep the
visible data on screen and mark its `LoadingRegion` busy with a localized
label. Reserve blocking states for work that makes interaction unsafe or
unavailable, and spinners for small indeterminate actions or short route-chunk
loads.

## Prefetch

[`routeModules.ts`](../src/routeModules.ts) shares each route loader between
rendering and prefetch. The authenticated shell warms only route chunks for
visible primary destinations during idle time. On internal links use
[`PrefetchLink`](../src/components/PrefetchLink.tsx) or the named feature link
wrappers. Focus and pointer hover may also warm planned API reads, while touch
warms the route module only. Add API reads to the
[shared prefetch plan](../src/hooks/usePrefetch.ts) only when the destination
requests that data on first render. Prefetch is best effort and navigation can
proceed independently. [Prefetch tests](../src/hooks/usePrefetch.test.ts) ·
[Browser smoke test](../tests/e2e/smoke.spec.ts)

See [Third-Party Notices](../THIRD-PARTY-NOTICES.md) for registry provenance,
attribution and distributed licenses.
