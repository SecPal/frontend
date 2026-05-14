<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# SecPal API — Onboarding E2E / Demo-Nutzer

## Canonical (SecPal/api Monorepo)

Im **API**-Repository existiert bereits `database/seeders/OnboardingDemoUserSeeder.php`
(`onboarding@example.com` / `password`, pre-contract, SecPal Holding).

Wichtig für Playwright-Live-Tests: `onboarding_workflow_status` muss **`account_initialized`** (oder `in_progress`) sein — im Zustand **`invited`** lehnt die API Entwürfe mit 422 ab, weil der erste Schritt den Workflow auf `in_progress` setzen will, was von `invited` aus nicht erlaubt ist (`Employee::ALLOWED_WORKFLOW_TRANSITIONS`).

`DatabaseSeeder` ruft `OnboardingDemoUserSeeder` auf; nach `php artisan migrate:fresh --seed` ist der Nutzer lauffähig.

## Referenz-Seeder in diesem Ordner

`OnboardingE2eUserSeeder.php` ist eine **vereinfachte Roh-SQL-Variante** für Forks ohne `OnboardingDemoUserSeeder`. Spalte für den Workflow:

| Spalte                       | Wert                  |
| ---------------------------- | --------------------- |
| `onboarding_workflow_status` | `account_initialized` |

## Soll-Daten (Kurz)

| Feld                | Wert                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| E-Mail / Login      | `onboarding@example.com`                                               |
| Passwort            | `password`                                                             |
| Name                | John Doe                                                               |
| Geburtstag          | 1990-01-01                                                             |
| Position            | Sicherheitsmitarbeiter                                                 |
| Führung             | nein (`management_level` 0)                                            |
| Vertragsbeginn      | 2028-05-01                                                             |
| Status              | `pre_contract`                                                         |
| Onboarding-Workflow | `onboarding_workflow_status` = `account_initialized` (nicht `invited`) |

Playwright nutzt dieses Konto automatisch, wenn `PLAYWRIGHT_BASE_URL` mit `https://` gesetzt ist und `PLAYWRIGHT_LIVE_ONBOARDING=1` — ohne `TEST_USER_*` Override.
