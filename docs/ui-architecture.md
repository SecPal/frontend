<!--
SPDX-FileCopyrightText: 2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# UI architecture

SecPal uses shadcn/ui as its component layer, Base UI as its primitive layer,
Tailwind CSS for styling, and Lucide for general-purpose icons. Product
components compose the shared components in `src/ui`; they do not recreate
dialogs, menus, selects, focus management, keyboard navigation, portals, or
dismissable layers.

`components.json` is the shadcn contract. Use the versioned official shadcn CLI
and official Base UI registry output, inspect generated diffs, and preserve
SecPal behavior and design tokens. Community registries require an explicit
architecture and license review. New Radix packages, general icon libraries,
parallel primitive libraries, and compatibility facades are prohibited.

Application code uses Tailwind classes, finite variants, semantic attributes,
and stylesheet tokens. JSX `style` props and direct `CSSStyleDeclaration`
changes are prohibited. The official `tw-animate-css` integration supplies
shadcn transition utilities, while the shared stylesheet reduces animation and
transition durations for `prefers-reduced-motion: reduce`. Brand assets and
domain-specific symbols that Lucide does not provide remain static reviewed
assets.

The migration retained SecPal product compositions including authentication,
onboarding, organizational-unit management, employee management, customer and
site workflows, and the application shell. Shared interaction behavior now
comes from Base UI. `motion`, `cmdk`, `input-otp`, and all Radix packages were
removed because no required use remained.
