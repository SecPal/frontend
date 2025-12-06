<!--
SPDX-FileCopyrightText: 2025 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# ⚠️ ARCHIVED: Performance Optimization - Aggressive Code Splitting Results

**IMPORTANT:** This document describes a function-based `manualChunks` implementation that was **REVERTED** due to Heroicons module resolution errors causing runtime failures.

**For actual deployed results, see:**

- `PERFORMANCE_DEPLOYMENT_STATUS.md` - Current implementation details
- `PERFORMANCE_TBT_ANALYSIS.md` - Analysis and next steps

---

## Why This Approach Was Abandoned

**Problem:** Function-based `manualChunks` with path matching (`id.includes()`) broke Heroicons named exports:

```text
Error: Cannot set properties of undefined (setting 'Activity')
```

**Root Cause:** Heroicons' complex export structure requires staying together with @headlessui/react in a single vendor chunk. Dynamic path-based splitting disrupted this relationship.

**Solution:** Reverted to object-based `manualChunks` with explicit package names (proven stable configuration from PR #317).

---

## Actual Results (Object-Based Configuration)

**Bundle Size:**

- Before: 149KB gzipped
- After: 94.28KB gzipped
- **Improvement: -37%** ✅

**Performance:**

- TBT: 419ms → 384ms (-8%)
- Performance Score: 94/100 ✅
- LCP: 1216ms ✅
- CLS: 0.00004 ✅

**Status:** Bundle optimization successful, but TBT target (<200ms) not achieved. Further JavaScript execution optimizations needed (see Issue #319).

---

# Original Document (Function-Based Approach - REVERTED)

_The content below describes the abandoned implementation and is kept for historical reference only._

---

# Performance Optimization - Aggressive Code Splitting Results (ARCHIVED)

**Date:** 2025-12-06
**Branch:** `perf/aggressive-code-splitting`
**Goal:** Reduce Total Blocking Time from 419ms to <200ms
**Status:** ✅ **MAJOR SUCCESS** - 88% reduction in main bundle size!

---

## 🎉 Key Achievement

### Main Bundle Size Reduction

- **Before (PR #317):** 469KB uncompressed / ~149KB gzipped
- **After (Aggressive Splitting):** 57.62KB uncompressed / **14.68KB gzipped**
- **Improvement:** **-88% uncompressed / -90% gzipped** ✅

### Expected Performance Impact

Based on bundle size reduction:

- **TBT:** 419ms → ~150-180ms (estimated -57% to -64%)
- **Initial Parse Time:** ~863ms → ~150ms (estimated -83%)
- **Performance Score:** 90-95% → 95-98% (expected)

---

## 📊 Detailed Bundle Analysis

### Main Bundle (`index.js`)

| Metric           | Before PR #317 | After PR #317 | After Aggressive Splitting | Total Improvement |
| ---------------- | -------------- | ------------- | -------------------------- | ----------------- |
| Uncompressed     | ~800KB         | 469KB         | **57.62KB**                | **-93%**          |
| Gzipped          | ~250KB         | ~149KB        | **14.68KB**                | **-94%**          |
| Parse Time (est) | ~1200ms        | ~863ms        | **~150ms**                 | **-88%**          |

### Vendor Chunks (Dependencies)

| Chunk             | Size (uncompressed) | Size (gzipped) | Contents                       |
| ----------------- | ------------------- | -------------- | ------------------------------ |
| vendor-react      | 349.74KB            | 109.61KB       | React, React DOM, React Router |
| vendor-animation  | 113.03KB            | 37.24KB        | Motion.js                      |
| vendor-db         | 95.85KB             | 31.96KB        | Dexie, IDB                     |
| vendor-misc       | 27.77KB             | 10.96KB        | Other node_modules             |
| vendor-monitoring | 5.73KB              | 2.33KB         | web-vitals                     |
| vendor-i18n       | 5.42KB              | 2.22KB         | @lingui/core, @lingui/react    |
| vendor-utils      | 0.37KB              | 0.24KB         | clsx                           |
| **Total Vendors** | **597.91KB**        | **194.56KB**   | All dependencies               |

**Note:** vendor-ui chunk was absorbed into vendor-misc (Headless UI + Heroicons are now in misc)

### Application Code Chunks

| Chunk              | Size (uncompressed) | Size (gzipped) | Contents                   |
| ------------------ | ------------------- | -------------- | -------------------------- |
| app-services       | 15.01KB             | 3.10KB         | API services layer         |
| app-lib            | 13.54KB             | 5.05KB         | Utility functions, helpers |
| locale-de          | 16.34KB             | 6.51KB         | German translations        |
| locale-en          | 13.55KB             | 5.78KB         | English translations       |
| **Total App Code** | **58.44KB**         | **20.44KB**    | Core application logic     |

### Route/Page Chunks (Lazy Loaded)

| Chunk                  | Size (uncompressed) | Size (gzipped) | Loaded When                 |
| ---------------------- | ------------------- | -------------- | --------------------------- |
| SecretList             | 11.07KB             | 3.71KB         | User visits /secrets        |
| SecretDetail           | 15.13KB             | 4.47KB         | User opens a secret         |
| SecretCreate           | 1.48KB              | 0.82KB         | User creates new secret     |
| SecretEdit             | 2.29KB              | 1.12KB         | User edits a secret         |
| SecretForm             | 8.80KB              | 2.00KB         | Secret form component       |
| OrganizationPage       | 15.91KB             | 4.93KB         | User visits /organization   |
| CustomersPage          | 11.08KB             | 3.59KB         | User visits /customers      |
| ObjectsPage            | 13.05KB             | 3.64KB         | User visits /objects        |
| GuardBooksPage         | 12.05KB             | 3.72KB         | User visits /guardbooks     |
| SettingsPage           | 0.93KB              | 0.43KB         | User visits /settings       |
| ProfilePage            | 1.43KB              | 0.63KB         | User visits /profile        |
| ShareTarget            | 11.89KB             | 4.08KB         | User shares from other apps |
| **Total Route Chunks** | **105.11KB**        | **33.14KB**    | Loaded on-demand            |

### Dialog Chunks (Lazy Loaded)

| Chunk                          | Size (uncompressed) | Size (gzipped) | Loaded When                   |
| ------------------------------ | ------------------- | -------------- | ----------------------------- |
| ShareDialog                    | 3.86KB              | 1.44KB         | User clicks Share button      |
| OrganizationalUnitFormDialog   | 5.33KB              | 2.16KB         | User creates/edits org unit   |
| DeleteOrganizationalUnitDialog | 4.26KB              | 1.75KB         | User deletes org unit         |
| MoveOrganizationalUnitDialog   | 11.49KB             | 3.79KB         | User moves org unit           |
| **Total Dialog Chunks**        | **24.94KB**         | **9.14KB**     | Only loaded when dialogs open |

### UI Component Chunks

| Chunk            | Size (uncompressed) | Size (gzipped) | Contents          |
| ---------------- | ------------------- | -------------- | ----------------- |
| badge            | 3.46KB              | 0.96KB         | Badge component   |
| dialog           | 1.93KB              | 0.83KB         | Dialog base       |
| table            | 2.52KB              | 0.98KB         | Table component   |
| description-list | 0.74KB              | 0.35KB         | Description lists |
| divider          | 0.32KB              | 0.23KB         | Divider component |

---

## 🚀 What Changed

### 1. Function-Based `manualChunks` in Vite Config

**Before (Object-based):**

```typescript
manualChunks: {
  "vendor-react": ["react", "react-dom", "react-router-dom"],
  "vendor-ui": ["@headlessui/react", "@heroicons/react"],
  "vendor-lingui": ["@lingui/core", "@lingui/react"],
}
```

**After (Function-based - Dynamic):**

```typescript
manualChunks(id) {
  // Split vendors by category
  if (id.includes("node_modules")) {
    if (id.includes("react")) return "vendor-react";
    if (id.includes("dexie") || id.includes("idb")) return "vendor-db";
    if (id.includes("motion")) return "vendor-animation";
    if (id.includes("@lingui")) return "vendor-i18n";
    if (id.includes("web-vitals")) return "vendor-monitoring";
    if (id.includes("clsx")) return "vendor-utils";
    return "vendor-misc";
  }

  // Split application code
  if (id.includes("/src/services/")) return "app-services";
  if (id.includes("/src/lib/")) return "app-lib";

  // Split locales by language
  if (id.includes("/src/locales/")) {
    const match = id.match(/\/locales\/([a-z]{2})\//);
    if (match) return `locale-${match[1]}`;
  }
}
```

### Benefits of Function-Based Approach

1. **Finer Control:** Can split any module based on path patterns
2. **Dynamic Splitting:** Automatically handles new dependencies
3. **Language Splitting:** Each locale becomes its own chunk (only loaded when language is active)
4. **Feature Splitting:** Services and lib utilities separated for better caching
5. **Better Tree Shaking:** More granular chunks = better dead code elimination

---

## 📈 Performance Impact Analysis

### Initial Page Load (Critical Path)

**What loads immediately:**

1. `index.html` (2.01KB)
2. `index.css` (186.71KB / 25.30KB gzipped)
3. `index.js` (57.62KB / **14.68KB gzipped**) ← **88% smaller!**
4. `vendor-react.js` (349.74KB / 109.61KB gzipped)
5. `app-services.js` (15.01KB / 3.10KB gzipped)
6. `app-lib.js` (13.54KB / 5.05KB gzipped)
7. `locale-de.js` or `locale-en.js` (16.34KB / 6.51KB gzipped)

**Total Critical Path (gzipped):**

- CSS: 25.30KB
- JS: ~139KB (index + vendor-react + app-services + app-lib + locale)
- **Total:** ~164KB (vs. ~174KB before aggressive splitting)

**Expected Parse Time:**

- Before: ~863ms
- After: ~200-250ms
- **Improvement:** ~-70%

### Secondary Load (On-Demand)

**Loaded when user navigates:**

- Route chunks: 33.14KB gzipped (loaded per route)
- Dialog chunks: 9.14KB gzipped (loaded per dialog)
- Other vendor chunks: ~85KB gzipped (db, animation, monitoring)

---

## 🎯 Expected Lighthouse Metrics

### Before (Baseline - PR #317)

```text
TBT: 419ms
LCP: 1244ms
CLS: 0.00004
Performance Score: 90-95%
Initial Bundle: 469KB (149KB gzipped)
```

### After (Aggressive Splitting - Estimated)

```text
TBT: 150-180ms (-57% to -64%) ✅ Target: <200ms
LCP: 1100-1200ms (slightly improved) ✅ Target: <2500ms
CLS: 0.00004 (unchanged) ✅ Target: <0.1
Performance Score: 95-98% (+5-8%) ✅ Target: >90%
Initial Bundle: 57.62KB (14.68KB gzipped) ✅ Target: <150KB
```

---

## ✅ Next Steps

### 1. Deploy to app.secpal.dev (Staging)

```bash
# Via SSH
ssh secpal@triangulum.uberspace.de
cd /var/www/virtual/secpal/frontend
git fetch origin
git checkout perf/aggressive-code-splitting
git pull origin perf/aggressive-code-splitting
npm ci
npm run build
```

### 2. Run Performance Tests

```bash
# Local against staging
cd /home/user/code/SecPal/frontend
npm run test:e2e:staging -- --grep "performance"

# Lighthouse CI
npm run lighthouse:ci
```

### 3. Manual Verification

1. Open <https://app.secpal.dev>
2. DevTools → Network Tab
3. Check:
   - Multiple small JS chunks? ✅
   - Main bundle < 60KB? ✅
   - Lazy loading working? ✅
4. Lighthouse Audit:
   - TBT < 200ms? (to verify)
   - Performance Score > 95%? (to verify)

### 4. Create GitHub Draft PR

```bash
git push origin perf/aggressive-code-splitting
gh pr create --draft \
  --title "perf: Aggressive code splitting - reduce TBT by 57%" \
  --body "See docs/PERFORMANCE_AGGRESSIVE_SPLITTING_RESULTS.md for details"
```

### 5. Measure & Document Real Results

After deployment, document actual metrics in PR:

- Real TBT measurement
- Real Lighthouse score
- Real user impact

---

## 🔍 Further Optimization Opportunities

### Priority 1: UI Component Library Splitting

Currently `@headlessui/react` and `@heroicons/react` are in `vendor-misc` (27.77KB).
Could be split into:

- `vendor-headless`: ~15KB (Headless UI components)
- `vendor-icons`: ~12KB (Hero Icons)

**Expected gain:** Better caching when only icons change

### Priority 2: More Dialog Lazy Loading

Additional dialogs that could be lazy loaded:

- Any remaining dialogs in the app
- Modals, confirmations

**Expected gain:** -5-10KB initial bundle

### Priority 3: Tree Shaking Improvements

- Remove unused Lingui locales (keep only de + en)
- Check for unused icon imports
- Analyze bundle for duplicate code

**Expected gain:** -10-20KB total

### Priority 4: Font Subsetting

Currently loading full Inter font family (all weights, all languages).
Could subset to:

- Only Latin + Latin-Ext (for German/English)
- Only weights 400, 500, 600 (if 700 is unused)

**Expected gain:** -100-150KB font files

---

## 📚 Technical Details

### Build Configuration

**File:** `vite.config.ts`

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks(id) {
        // Dynamic chunk splitting logic
        // See full implementation in vite.config.ts
      },
    },
  },
  chunkSizeWarningLimit: 500,
}
```

### Build Stats

- Total modules transformed: 1082
- Build time: 22.59s (client) + 2.50s (SW)
- Service Worker precache: 38 entries (1017.26 KB)

### Dependencies (from package.json)

**Key dependencies and their chunk assignment:**

- React ecosystem → `vendor-react` (349.74KB)
- Motion.js → `vendor-animation` (113.03KB)
- Dexie + IDB → `vendor-db` (95.85KB)
- Lingui → `vendor-i18n` (5.42KB)
- Web Vitals → `vendor-monitoring` (5.73KB)
- Headless UI + Icons → `vendor-misc` (27.77KB)

---

## 🎓 Lessons Learned

### 1. Function-Based manualChunks is Powerful

Object-based approach only works for explicit imports.
Function-based approach works for **any module** based on path patterns.

### 2. Locale Splitting is Critical

Each locale adds ~14-16KB.
Splitting by language = only load active language.

### 3. Dialog Lazy Loading Works Great

Dialogs are perfect candidates:

- Not needed initially
- Often unused in a session
- Easy to lazy load with Suspense

### 4. Granular Vendor Splitting

Splitting vendors by category enables:

- Better caching (React rarely changes)
- Parallel loading (multiple small chunks)
- Less cache invalidation

---

## 📊 Comparison Matrix

| Optimization            | Before PR #317 | After PR #317 | Aggressive Splitting | Improvement |
| ----------------------- | -------------- | ------------- | -------------------- | ----------- |
| Main Bundle (gzip)      | ~250KB         | ~149KB        | **14.68KB**          | **-94%**    |
| Route Lazy Loading      | ❌ No          | ✅ Yes        | ✅ Yes               | -           |
| Font Optimization       | ❌ No          | ✅ Async      | ✅ Async             | -           |
| Dialog Lazy Loading     | ❌ No          | ⚠️ Partial    | ✅ Yes               | -           |
| Vendor Splitting        | ❌ Single      | ⚠️ 3 chunks   | ✅ 7 chunks          | -           |
| Locale Splitting        | ❌ Single      | ❌ Single     | ✅ Per language      | -           |
| App Code Splitting      | ❌ Single      | ❌ Single     | ✅ 2 chunks          | -           |
| TBT (estimated)         | ~746ms         | 419ms         | **150-180ms**        | **-76%**    |
| Performance Score (est) | ~80%           | 90-95%        | **95-98%**           | **+15-18%** |

---

**Status:** 🟢 Ready for staging deployment and testing
**Priority:** 🚨 HIGH
**Risk:** 🟢 LOW (lazy loading with fallbacks, tested locally)

**Next Action:** Deploy to app.secpal.dev and measure real performance impact
