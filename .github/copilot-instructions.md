<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Frontend Repository Instructions

These instructions are self-contained for the `frontend` repository at runtime.
Do not assume instructions from sibling repositories or comment-based inheritance are loaded.

## Always-On Rules

- Apply SecPal core rules on every task: TDD first, fail fast, no bypass,
  one topic per change, and create a GitHub issue immediately for findings
  that cannot be fixed in the current scope.
- Before any commit, PR, or merge, announce and verify the required checklist. Stop on the first failed check.
- Update `CHANGELOG.md` in the same change set for real fixes, features, or breaking changes.
- Keep GitHub-facing communication in English.
- Domain policy is strict: use only `secpal.app` and `secpal.dev`.
- Prefer small, user-visible fixes that match existing patterns. Avoid speculative abstractions.

## Repository Stack

- Node 22, React, TypeScript strict mode, Vite, Vitest, React Testing Library.
- All API types come from generated OpenAPI types. Use `@/types/api` and do not hand-write API response types.

## Architecture

- Keep presentation in components and logic in hooks or API clients.
- Prefer functional components, named exports, and one component per file.
- Use React built-ins first. Introduce extra state libraries only when the
  existing codebase already uses them or the task truly requires them.

## Frontend Rules

- Preserve strict TypeScript. Do not introduce `any` without a concrete, justified boundary.
- Test user-visible behavior with Testing Library and MSW where applicable.
- Run the smallest relevant validation for every change: tests, typecheck, and lint for affected areas.
- Keep accessibility, semantic HTML, focus behavior, and responsive layouts intact.
- Prefer generated API types, container-presenter separation, and existing design system patterns.

## Scope Notes

- Do not add dependencies or create documentation files unless the task requires it.
- Treat this file as the runtime baseline for the repo. Repo-specific `.instructions.md` files add detail for matching files.
