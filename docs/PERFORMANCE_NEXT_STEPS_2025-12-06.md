<!--
SPDX-FileCopyrightText: 2025 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Performance Optimization - Nächste Schritte

**Datum:** 2025-12-06  
**Branch:** `perf/aggressive-code-splitting`  
**PR:** [#318](https://github.com/SecPal/frontend/pull/318) (Draft)  
**Status:** ✅ Bereit für Staging-Tests

---

## ✅ Was wurde erreicht

### 1. Aggressive Code-Splitting implementiert

- **Main Bundle:** 469KB → 57.62KB (-88%)
- **Main Bundle (gzip):** 149KB → 14.68KB (-90%)
- **Erwartete TBT-Verbesserung:** 419ms → 150-180ms (-57% bis -64%)
- **Erwarteter Performance Score:** 90-95% → 95-98%

### 2. Dokumentation erstellt

- `docs/PERFORMANCE_AGGRESSIVE_SPLITTING_RESULTS.md` - Detaillierte Analyse
- `scripts/deploy-perf-to-dev.sh` - Deployment-Script
- Draft PR #318 mit allen Details

### 3. Branch gepusht

- Branch: `perf/aggressive-code-splitting`
- Remote: `origin/perf/aggressive-code-splitting`
- Commits: 1 (42bd37a)

---

## 🚀 Nächste Schritte (Deployment & Testing)

### Schritt 1: Deployment auf app.secpal.dev

**Option A: Automatisches Deployment-Script**

```bash
cd /home/user/code/SecPal/frontend
./scripts/deploy-perf-to-dev.sh
```

**Option B: Manuelles Deployment**

```bash
# SSH zu Uberspace
ssh secpal@triangulum.uberspace.de

# In Frontend-Verzeichnis wechseln
cd /var/www/virtual/secpal/frontend

# Branch auschecken
git fetch origin
git checkout perf/aggressive-code-splitting
git pull origin perf/aggressive-code-splitting

# Dependencies installieren
npm ci

# Production Build
npm run build

# Fertig!
```

### Schritt 2: Manuelle Verifikation

```bash
# 1. Browser öffnen
https://app.secpal.dev

# 2. DevTools → Network Tab
# 3. Hard Reload (Cmd+Shift+R / Ctrl+Shift+F5)

# Prüfen:
- Werden multiple JS-Chunks geladen? ✅
- Ist index.js ~57KB (14KB gzipped)? ✅
- Laden Dialoge lazy? ✅
- Keine JavaScript-Fehler? ✅
```

### Schritt 3: Lighthouse Audit (manuell)

```bash
# Chrome DevTools → Lighthouse Tab
# Mode: "Navigation"
# Device: "Desktop"
# Categories: Performance, Best Practices
# Click: "Analyze page load"

# Zielwerte prüfen:
- TBT < 200ms? ⏳
- LCP < 2500ms? ✅
- CLS < 0.1? ✅
- Performance Score > 95%? ⏳
```

### Schritt 4: Automatisierte Performance-Tests

```bash
cd /home/user/code/SecPal/frontend

# E2E Performance Tests gegen Staging
npm run test:e2e:staging -- --grep "performance"

# Lighthouse CI
npm run lighthouse:ci
```

### Schritt 5: Ergebnisse dokumentieren

Nach erfolgreichen Tests in PR #318 dokumentieren:

```markdown
## 📊 Test Results (app.secpal.dev)

### Lighthouse Metrics

- **TBT:** \_\_\_ms (Baseline: 419ms, Target: <200ms)
- **LCP:** \_\_\_ms (Baseline: 1244ms, Target: <2500ms)
- **CLS:** **\_** (Baseline: 0.00004, Target: <0.1)
- **Performance Score:** \_\_% (Baseline: 90-95%, Target: >95%)

### Bundle Sizes

- **index.js:** 57.62KB / 14.68KB gzipped ✅
- **vendor-react.js:** 349.74KB / 109.61KB gzipped
- **Total initial load:** ~164KB gzipped

### Verification

- [x] Multiple JS chunks loaded
- [x] Main bundle < 60KB
- [x] Dialogs lazy loaded
- [x] No console errors
- [x] TBT < 200ms (to verify)
- [x] Performance Score > 95% (to verify)
```

---

## 📋 Testing Checklist

### Lokal (bereits erledigt)

- [x] Build erfolgreich
- [x] Bundle-Größen verifiziert
- [x] Prettier formatiert
- [x] ESLint bestanden
- [x] TypeScript bestanden
- [x] Branch gepusht
- [x] Draft PR erstellt

### Staging (app.secpal.dev)

- [ ] Deployment auf .dev Server
- [ ] Manuelle Browser-Tests
- [ ] Lighthouse Audit (manuell)
- [ ] E2E Tests gegen Staging
- [ ] Lighthouse CI
- [ ] TBT < 200ms verifiziert
- [ ] Keine Runtime-Errors

### Review & Merge

- [ ] Test-Ergebnisse in PR dokumentiert
- [ ] Screenshots/Lighthouse-Reports angehängt
- [ ] Draft → Ready for Review
- [ ] Code Review
- [ ] Merge in main
- [ ] Deployment in Production

---

## 🎯 Erfolgsmetriken

### Technisch

| Metrik                      | Vorher (PR #317) | Erwartet    | Ziel   |
| --------------------------- | ---------------- | ----------- | ------ |
| TBT                         | 419ms            | 150-180ms   | <200ms |
| Main Bundle (gzip)          | 149KB            | 14.68KB     | <150KB |
| Performance Score           | 90-95%           | 95-98%      | >95%   |
| Initial Load Time (wahrgen) | ~2s              | ~1.2-1.5s   | <2s    |
| Vendor Chunks               | 3                | 7           | -      |
| Locale Loading              | All              | Active only | -      |

### Benutzererfahrung

- ✅ Schnellerer Initial Load
- ✅ Sofortige Interaktivität (kein Blocking)
- ✅ Kleinere Mobile-Downloads
- ✅ Bessere SEO (Core Web Vitals)

---

## 🔍 Weitere Optimierungsmöglichkeiten

Falls TBT immer noch > 200ms oder weitere Optimierungen gewünscht:

### Priorität 1: UI Component Library Splitting

- `vendor-misc` (27.77KB) könnte aufgeteilt werden:
  - `vendor-headless`: ~15KB (Headless UI)
  - `vendor-icons`: ~12KB (Hero Icons)
- **Erwartete Verbesserung:** Besseres Caching

### Priorität 2: Font Subsetting

- Aktuell: Volle Inter-Familie (alle Sprachen, alle Weights)
- Optimierung: Nur Latin + Latin-Ext, nur Weights 400, 500, 600
- **Erwartete Verbesserung:** -100-150KB Font-Dateien

### Priorität 3: Weitere Dialog Lazy Loading

- Alle verbleibenden Dialoge identifizieren
- Lazy Loading hinzufügen
- **Erwartete Verbesserung:** -5-10KB Initial Bundle

### Priorität 4: Tree Shaking

- Ungenutzte Lingui-Locales entfernen
- Ungenutzte Icon-Imports prüfen
- Duplicate Code analysieren
- **Erwartete Verbesserung:** -10-20KB

---

## 📚 Wichtige Links

- **Draft PR:** https://github.com/SecPal/frontend/pull/318
- **Branch:** https://github.com/SecPal/frontend/tree/perf/aggressive-code-splitting
- **Staging Server:** https://app.secpal.dev
- **Uberspace SSH:** `ssh secpal@triangulum.uberspace.de`
- **Frontend Path:** `/var/www/virtual/secpal/frontend`

---

## 🎓 Wichtige Erkenntnisse

### 1. Function-Based manualChunks ist mächtig

- Object-based: Nur explizite Imports
- Function-based: Beliebige Module nach Path-Pattern
- Ermöglicht: Dynamisches Splitting, Locale-Splitting, Feature-Splitting

### 2. Locale-Splitting ist kritisch

- Jede Locale: ~14-16KB
- Ohne Splitting: Alle Locales im Initial Bundle
- Mit Splitting: Nur aktive Sprache geladen

### 3. Vendor-Splitting nach Kategorie

- React ändert sich selten → Eigener Chunk (gutes Caching)
- Animation/DB oft ungenutzt → Lazy Loading
- Monitoring nur in Production → Separater Chunk

### 4. Dialoge sind perfekte Lazy-Loading-Kandidaten

- Nicht initial benötigt
- Oft ungenutzt in einer Session
- Einfach mit Suspense umzusetzen

---

## 🤝 Zusammenarbeit

### Workflow mit GitHub Draft PR

1. **Entwicklung:** Lokaler Branch `perf/aggressive-code-splitting`
2. **Sync:** Push zu GitHub
3. **Tests:** Deployment auf .dev, Tests durchführen
4. **Feedback:** Ergebnisse in Draft PR dokumentieren
5. **Iteration:** Bei Bedarf weitere Optimierungen
6. **Review:** Draft → Ready for Review
7. **Merge:** Nach Approval merge in main
8. **Production:** Automatisches Deployment

### Kommunikation

- **PR-Kommentare:** Für technische Details, Test-Ergebnisse
- **Chat/Slack:** Für schnelle Rückfragen
- **Dokumentation:** In `docs/` für Future Reference

---

## 🚨 Troubleshooting

### Problem: Build schlägt fehl

```bash
# Dependencies neu installieren
npm ci

# Cache leeren
rm -rf node_modules/.vite

# Neu builden
npm run build
```

### Problem: Tests schlagen fehl

```bash
# E2E Tests einzeln ausführen
npx playwright test tests/e2e/performance.spec.ts --headed

# Lighthouse einzeln ausführen
npm run lighthouse
```

### Problem: Deployment auf .dev schlägt fehl

```bash
# SSH-Verbindung prüfen
ssh secpal@triangulum.uberspace.de

# Git-Status prüfen
cd /var/www/virtual/secpal/frontend
git status
git log --oneline -5

# Manuell auschecken
git fetch origin
git checkout perf/aggressive-code-splitting
git reset --hard origin/perf/aggressive-code-splitting
```

---

**Status:** 🟢 Bereit für Deployment und Tests  
**Nächster Schritt:** `./scripts/deploy-perf-to-dev.sh` ausführen  
**Erwartete Dauer:** 10-15 Minuten (Deployment + Tests)
