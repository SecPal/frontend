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
- Scope `role="status"` and `aria-live` to the exact dynamic content region, not to wider containers that
  also hold headings or interactive controls.
