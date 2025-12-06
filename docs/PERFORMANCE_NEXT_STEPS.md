<!--
SPDX-FileCopyrightText: 2025 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Performance Optimierung - Nächste Schritte

**Datum:** 2025-12-06
**Status:** ✅ Code-Änderungen abgeschlossen, bereit für .dev Testing
**Branch:** `perf/code-splitting-tbt-optimization`

---

## ✅ Was wurde gemacht

### 1. Code Splitting implementiert
- Alle Route-Komponenten lazy loaded
- Bundle-Size von 469KB auf 459KB reduziert
- Bessere Caching-Strategie durch getrennte Vendor-Chunks

### 2. Dialog-Komponenten optimiert
- ShareDialog lazy loaded
- OrganizationalUnitFormDialog lazy loaded
- Nur bei Bedarf geladen

### 3. Vendor-Chunks aufgeteilt
- vendor-ui → vendor-headless + vendor-icons
- Besseres Caching und paralleles Laden

### 4. Bundle Analyzer eingerichtet
- `npm run build:analyze` zeigt Bundle-Größen
- Identifiziert weitere Optimierungspotenziale

### 5. Dokumentation erstellt
- `PERFORMANCE_ANALYSIS_2025-12-06.md` - Baseline-Analyse
- `PERFORMANCE_README.md` - Executive Summary
- `PERFORMANCE_QUICK_WINS.md` - Implementierungsanleitung
- `PERFORMANCE_OPTIMIZATIONS_IMPLEMENTED.md` - Status-Tracking

---

## 🎯 Erwartete Verbesserungen

| Metrik | Vorher | Erwartet | Verbesserung |
|--------|--------|----------|--------------|
| TBT | 419ms | ~180-200ms | **-52%** |
| Initial Bundle | 469KB | 459KB | **-2%** |
| Initial Load (gzip) | ~160KB | ~150KB | **-6%** |
| Vendor Chunks | 1 (129KB) | 2 (getrennt) | Besseres Caching |

---

## 🚀 Deployment auf app.secpal.dev

### Option 1: Automatisches Deployment-Script

```bash
cd /home/user/code/SecPal/frontend
./scripts/deploy-to-dev.sh
```

### Option 2: Manuelle Schritte

```bash
# 1. Zu Uberspace verbinden
ssh secpal@triangulum.uberspace.de

# 2. Zum Frontend-Verzeichnis
cd ~/frontend

# 3. Branch auschecken und aktualisieren
git fetch origin
git checkout perf/code-splitting-tbt-optimization
git pull origin perf/code-splitting-tbt-optimization

# 4. Dependencies installieren
npm ci

# 5. Production Build
npm run build

# 6. Deployment verifizieren
# Browser öffnen: https://app.secpal.dev
# DevTools → Network → Check für multiple JS chunks
```

---

## 🧪 Performance-Tests auf .dev

### 1. Manuelle Tests im Browser

```
1. https://app.secpal.dev öffnen
2. DevTools → Network → Disable Cache
3. Hard Reload (Cmd+Shift+R / Ctrl+Shift+F5)
4. Prüfen:
   - Werden mehrere JS-Chunks geladen?
   - Sind die Chunks kleiner als vorher?
   - Laden Dialogs erst beim Öffnen?
```

### 2. Lighthouse Audit

```
1. Chrome DevTools → Lighthouse Tab
2. Mode: "Navigation" 
3. Device: "Desktop"
4. Categories: Performance, Best Practices
5. "Analyze page load" klicken
6. Metrics prüfen:
   - TBT < 200ms? ✅
   - LCP < 2500ms? ✅
   - Performance Score > 90%? ✅
```

### 3. Automatisierte Tests (lokal gegen .dev)

```bash
cd /home/user/code/SecPal/frontend

# Performance Tests
npm run test:e2e:staging -- --grep "performance"

# Lighthouse CI
npm run lighthouse:ci
```

---

## 📊 Messergebnisse dokumentieren

### Vorher (Baseline vom 2025-12-06)

```
TBT: 419ms
LCP: 1244ms
CLS: 0.00004
Performance Score: 90-95%
Initial Bundle: 469KB (149KB gzipped)
```

### Nachher (zu messen auf .dev)

```
TBT: ___ ms (Ziel: <200ms)
LCP: ___ ms (Ziel: <2500ms)
CLS: _____ (Ziel: <0.1)
Performance Score: ___% (Ziel: >90%)
Initial Bundle: ___ KB (___ KB gzipped)
```

### Bundle-Analyse

```bash
# Lokal analysieren
npm run build:analyze

# stats.html wird automatisch geöffnet
# Prüfen:
- Welche Module sind am größten?
- Gibt es Duplikate?
- Sind alle Optimierungen angewandt?
```

---

## 🔍 Weitere Optimierungen (wenn TBT noch > 200ms)

### Priorität 1: Weitere Dialogs lazy loaden

```typescript
// Diese Dialogs können noch optimiert werden:
- DeleteOrganizationalUnitDialog
- MoveOrganizationalUnitDialog  
- ConflictResolutionDialog
```

### Priorität 2: Heavy Features on-demand laden

```typescript
// Crypto-Operationen
const crypto = lazy(() => import('./lib/crypto'));

// File Upload
const FileUpload = lazy(() => import('./components/FileUpload'));

// Attachment Preview
const AttachmentPreview = lazy(() => import('./components/AttachmentPreview'));
```

### Priorität 3: Tree Shaking verbessern

```bash
# Prüfen welche Icons wirklich verwendet werden
npm run build:analyze

# Nicht benötigte Lingui-Locales entfernen
# Nur de + en behalten
```

---

## ✅ Erfolgskriterien

### Technisch
- ✅ TBT < 200ms
- ✅ LCP < 2500ms
- ✅ CLS < 0.1
- ✅ Performance Score > 90%
- ✅ Initial Bundle < 150KB (gzipped)

### User Experience
- ✅ Seite lädt schnell (gefühlt < 2 Sekunden)
- ✅ Keine sichtbaren Layout-Shifts
- ✅ Interaktionen reagieren sofort
- ✅ Keine JavaScript-Fehler in Console

### Deployment
- ✅ Build erfolgreich
- ✅ Alle Tests grün
- ✅ Keine TypeScript-Fehler
- ✅ Keine ESLint-Warnings

---

## 📝 Nächste Schritte nach .dev Tests

1. **Messergebnisse dokumentieren**
   - Screenshots von Lighthouse
   - DevTools Network Tab
   - Bundle-Analyzer Ergebnisse

2. **PR finalisieren**
   - Messergebnisse in PR Description
   - Vorher/Nachher Vergleich
   - Review anfordern

3. **Bei Bedarf weitere Optimierungen**
   - Wenn TBT noch > 200ms
   - Weitere Dialogs lazy loaden
   - Tree Shaking verbessern

4. **Merge nach Main**
   - Nach erfolgreichen Tests
   - Nach Code Review
   - Mit Squash Commit

5. **Production Deployment**
   - Deploy auf app.secpal.app
   - Production Monitoring
   - Real User Monitoring (RUM)

---

## 🔗 Wichtige Links

- **Frontend Repository:** https://github.com/SecPal/frontend
- **Branch:** https://github.com/SecPal/frontend/tree/perf/code-splitting-tbt-optimization
- **.dev Server:** https://app.secpal.dev
- **Uberspace SSH:** `ssh secpal@triangulum.uberspace.de`

---

## 📞 Support

Bei Fragen oder Problemen:
1. Issue in GitHub erstellen
2. Im Chat fragen
3. Dokumentation in `docs/` prüfen

---

**Status:** 🟢 Bereit für .dev Testing
**Nächster Schritt:** Deploy auf .dev Server und Performance messen
