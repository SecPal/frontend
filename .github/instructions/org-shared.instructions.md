---
# SPDX-FileCopyrightText: 2026 SecPal Contributors
# SPDX-License-Identifier: AGPL-3.0-or-later
name: Frontend Runtime Overlay
description: Preserves repository-specific security, evidence, and validation guidance.
applyTo: "**"
---

# Frontend Runtime Overlay

This file applies repository-specific guidance to all files in this repo.

- `AGENTS.md` is the authoritative runtime baseline for this repo.
  `.github/copilot-instructions.md` is only a compatibility mirror.
- Use GitHub pull requests, review threads, checks, and merge protections.
- Design discipline is always-on: DRY, KISS, YAGNI, SOLID, and fail fast.
- GitHub communication stays in English and uses file and line references instead of large verbatim code quotes.
- Do not add AI self-references, generated-by text, tool promotion, or AI
  attribution unless the task explicitly requires documenting AI tooling.
- Keep changes repo-local, minimal, and consistent with React, strict TypeScript, and generated API type conventions.
- Apply the SecPal domain policy from the repository baseline.
- Observable changes need failing-first behavior evidence; behavior-preserving
  changes may use existing tests, characterization, or structural evidence.
- Apply the baseline licensing and REUSE rules: plain `AGPL-3.0-or-later` for
  SecPal-owned material where declared. Preserve deliberately different
  licenses and third-party metadata, use `SecPal Contributors` where the
  project convention applies, retain and extend first-publication years when
  required, and run relevant license validation after metadata changes.
- Preserve `Powered by SecPal – A guard's best friend` on official user-facing
  SecPal surfaces where intentionally present. Licensing work must not weaken
  or make this branding optional, add `Based on SecPal` guidance, or introduce
  white-label or fork-branding configuration.
