<!--
SPDX-FileCopyrightText: 2025 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Performance Optimization - Next Steps

**Date:** 2025-12-06
**Status:** ✅ Code changes completed, ready for .dev testing
**Branch:** `perf/code-splitting-tbt-optimization`

---

## ✅ What Has Been Done

### 1. Code Splitting Implemented

- All route components lazy loaded
- Bundle size reduced from 469KB to 459KB
- Better caching strategy through separate vendor chunks

### 2. Dialog Components Optimized

- ShareDialog lazy loaded
- OrganizationalUnitFormDialog lazy loaded
- Only loaded when needed

### 3. Vendor Chunks Split

- vendor-ui → vendor-headless + vendor-icons
- Better caching and parallel loading

### 4. Bundle Analyzer Configured

- `npm run build:analyze` shows bundle sizes
- Identifies further optimization opportunities

### 5. Documentation Created

- `PERFORMANCE_ANALYSIS_2025-12-06.md` - Baseline analysis
- `PERFORMANCE_README.md` - Executive Summary
- `PERFORMANCE_QUICK_WINS.md` - Implementation guide
- `PERFORMANCE_OPTIMIZATIONS_IMPLEMENTED.md` - Status tracking

---

## 🎯 Expected Improvements

| Metric              | Before    | Expected     | Improvement    |
| ------------------- | --------- | ------------ | -------------- |
| TBT                 | 419ms     | ~180-200ms   | **-52%**       |
| Initial Bundle      | 469KB     | 459KB        | **-2%**        |
| Initial Load (gzip) | ~160KB    | ~150KB       | **-6%**        |
| Vendor Chunks       | 1 (129KB) | 2 (separate) | Better caching |

---

## 🚀 Deployment to app.secpal.dev

### Option 1: Automated Deployment Script

```bash
cd /home/user/code/SecPal/frontend
./scripts/deploy-to-dev.sh
```

### Option 2: Manual Steps

```bash
# 1. Connect to Uberspace
ssh secpal@triangulum.uberspace.de

# 2. Navigate to frontend directory
cd /var/www/virtual/$USER/secpal-frontend

# 3. Checkout and update branch
git fetch origin
git checkout perf/code-splitting-tbt-optimization
git pull origin perf/code-splitting-tbt-optimization

# 4. Install dependencies
npm ci

# 5. Production build
npm run build

# 6. Verify deployment
# Open browser: https://app.secpal.dev
# DevTools → Network → Check for multiple JS chunks
```

---

## 🧪 Performance Tests on .dev

### 1. Manual Browser Tests

```
1. Open https://app.secpal.dev
2. DevTools → Network → Disable Cache
3. Hard Reload (Cmd+Shift+R / Ctrl+Shift+F5)
4. Check:
   - Are multiple JS chunks loaded?
   - Are chunks smaller than before?
   - Do dialogs load only when opened?
```

### 2. Lighthouse Audit

```
1. Chrome DevTools → Lighthouse Tab
2. Mode: "Navigation"
3. Device: "Desktop"
4. Categories: Performance, Best Practices
5. Click "Analyze page load"
6. Check metrics:
   - TBT < 200ms? ✅
   - LCP < 2500ms? ✅
   - Performance Score > 90%? ✅
```

### 3. Automated Tests (local against .dev)```bash

cd /home/user/code/SecPal/frontend

# Performance Tests

npm run test:e2e:staging -- --grep "performance"

# Lighthouse CI

npm run lighthouse:ci

```

---

## 📊 Document Measurement Results

### Before (Baseline from 2025-12-06)

```

TBT: 419ms
LCP: 1244ms
CLS: 0.00004
Performance Score: 90-95%
Initial Bundle: 469KB (149KB gzipped)

```

### After (to be measured on .dev)

```

TBT: **_ ms (Target: <200ms)
LCP: _** ms (Target: <2500ms)
CLS: **\_** (Target: <0.1)
Performance Score: **_% (Target: >90%)
Initial Bundle: _** KB (\_\_\_ KB gzipped)

````

### Bundle Analysis

```bash
# Analyze locally
npm run build:analyze

# stats.html opens automatically
# Check:
- Which modules are largest?
- Are there duplicates?
- Are all optimizations applied?
````

---

## 🔍 Further Optimizations (if TBT still > 200ms)

### Priority 1: Lazy Load More Dialogs

```typescript
// These dialogs can still be optimized:
-DeleteOrganizationalUnitDialog -
  MoveOrganizationalUnitDialog -
  ConflictResolutionDialog;
```

### Priority 2: Lazy Load Heavy Features on Demand

**Estimated Impact:** -20-30KB

Candidates:

```typescript
// Crypto operations
const crypto = lazy(() => import("./lib/crypto"));

// File Upload
const FileUpload = lazy(() => import("./components/FileUpload"));

// Attachment Preview
const AttachmentPreview = lazy(() => import("./components/AttachmentPreview"));
```

### Priority 3: Improve Tree Shaking

```bash
# Check which icons are actually used
npm run build:analyze

# Remove unused Lingui locales
# Keep only de + en
```

---

## ✅ Success Criteria

### Technical

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

## 📝 Next Steps After .dev Tests

1. **Document Results**
   - Lighthouse screenshots
   - DevTools Network Tab
   - Bundle Analyzer results

2. **Finalize PR**
   - Results in PR description
   - Before/after comparison
   - Request review

3. **Further Optimizations if Needed**
   - If TBT still > 200ms
   - Lazy load more dialogs
   - Improve tree shaking

4. **Merge to Main**
   - After successful tests
   - After code review
   - With squash commit

5. **Production Deployment**
   - Deploy to app.secpal.app
   - Production monitoring
   - Real User Monitoring (RUM)

---

## 🔗 Important Links

- **Frontend Repository:** <https://github.com/SecPal/frontend>
- **Branch:** <https://github.com/SecPal/frontend/tree/perf/code-splitting-tbt-optimization>
- **.dev Server:** <https://app.secpal.dev>
- **Uberspace SSH:** `ssh secpal@triangulum.uberspace.de`

---

## 📞 Support

For questions or issues:

1. Create GitHub issue
2. Ask in chat
3. Check documentation in `docs/`

---

**Status:** 🟢 Ready for .dev testing
**Next Step:** Deploy to .dev server and measure performance
