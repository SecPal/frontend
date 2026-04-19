---
# SPDX-FileCopyrightText: 2026 SecPal
# SPDX-License-Identifier: AGPL-3.0-or-later
name: React TypeScript Rules
description: Applies React and strict TypeScript rules to frontend source files.
applyTo: "src/**/*.ts,src/**/*.tsx,tests/**/*.ts,tests/**/*.tsx,vite.config.ts"
---

# React TypeScript Rules

- Keep components presentational where possible and move reusable logic into hooks or API clients.
- Use functional components, named exports, and explicit props interfaces.
- Preserve strict TypeScript and generated API types from `@/types/api`.
- Test user-visible behavior with Testing Library. Prefer MSW for API boundaries.
- Run the smallest relevant validation for each change: tests, typecheck, and lint.
- Maintain accessibility, semantic markup, and responsive behavior.
- Default boolean security flags (e.g. `emailVerified`) to `false` in sanitization layers; never leave them
  `undefined` on authenticated state.
- Do not persist auth state or other sensitive user-derived data via direct
  cleartext `localStorage`/`sessionStorage` writes. Use the approved storage
  abstraction in runtime code, and in tests seed authenticated state through
  `authStorage.setUser()` or a real current-format encrypted envelope.
- Scope `role="status"` and `aria-live` to the exact dynamic content region, not to wider containers that
  also hold headings or interactive controls.
- For AI-suggested async fixes, prove ordering with tests; when cleanup must happen after an awaited call settles,
  prefer `try/finally` over early local-state clearing.
- Keep plain-text-only HTML contexts such as `<option>` children free of wrapper components; use translated strings,
  not `<Trans>` or other element-producing helpers.
- Keep load, action, and destructive-flow error state separate when they drive different UI branches.
- Because the SecPal project is still under `1.x`, do not preserve obsolete
  compatibility shims by default. If a legacy storage format, input alias, or
  deprecated frontend contract has no proven live caller, prefer removing it
  and updating tests and changelog coverage in the same change.
