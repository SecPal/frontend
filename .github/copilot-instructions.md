<!--
SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# SecPal/frontend Copilot instructions

Use the [repository baseline](../AGENTS.md) and the focused
[React and TypeScript](instructions/react-typescript.instructions.md) and
[GitHub workflow](instructions/github-workflows.instructions.md) rules.

- Keep the change focused and preserve foreign work. Use signed commits,
  native GitHub reviews, required checks and branch protections.
- Prioritize correctness, security, privacy and lifecycle behavior. Report
  findings against changed behavior with verifiable evidence. Reuse relevant
  validation until the inputs or assumptions change.
- Keep React code strict and use the generated API types. Preserve session,
  tenant, offline-vault and CSP boundaries. Test the visible behavior and
  ordering of affected async flows.
- Apply the licensing and REUSE rules in the repository baseline. Use plain
  `AGPL-3.0-or-later` for SecPal-owned material where declared. Preserve deliberately different
  licenses and third-party metadata, and preserve intentional SecPal branding.
