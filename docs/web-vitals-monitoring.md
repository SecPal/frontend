<!--
SPDX-FileCopyrightText: 2025-2026 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Web Vitals and local telemetry

[Browser startup](../src/main.tsx) calls `initWebVitals()` automatically.
[Web Vitals](../src/lib/webVitals.ts) registers CLS, INP, LCP, FCP and TTFB
observers. It keeps reported metrics in page memory, where `getPerformanceMetrics()`
returns a copy of the array and `clearPerformanceMetrics()` empties it.

The Web Vitals library supplies each metric's rating. Development builds log
warnings for `needs-improvement` and `poor` ratings, using the module's
`PERFORMANCE_THRESHOLDS` as diagnostic context.

## Local analytics

The Web Vitals reporter forwards a metric to analytics when a stored user
is present. [Analytics](../src/lib/analytics.ts) accepts records only while
tracking is active for an authenticated user. The event's user and session
identifiers are held in its encrypted payload in the
[offline vault](../src/lib/offlineVault.ts). The local sync routine marks
events as synced in IndexedDB. Browser analytics has no backend export endpoint.

Vault records can persist across reloads. The analytics store has no time or
count limit. Destructive logout clears the persisted records as part of the
[vault lifecycle](OFFLINE_ENCRYPTED_VAULT_DESIGN.md#lock-unlock-and-logout-semantics).
The in-memory analytics reset runs after the persistent cleanup commits. The
separate Web Vitals array remains in memory until cleared or the page ends.

## Lighthouse CI

[Lighthouse CI](../.github/workflows/lighthouse.yml) audits the static build
on pull requests and pushes to `main`. It produces its own lab reports and
uses the budgets in [`lighthouserc.cjs`](../lighthouserc.cjs), including FCP,
LCP, CLS and Total Blocking Time. Browser Web Vitals uses INP and also measures
TTFB.

Run the [Web Vitals](../src/lib/webVitals.test.ts),
[analytics](../src/lib/analytics.test.ts) and
[Lighthouse configuration](../tests/lighthouse.config.test.ts) tests together:

```bash
npm test -- src/lib/webVitals src/lib/analytics.test.ts tests/lighthouse.config.test.ts
```
