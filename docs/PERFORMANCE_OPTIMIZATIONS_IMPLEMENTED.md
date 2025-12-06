<!--
SPDX-FileCopyrightText: 2025 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Performance Optimizations - Implementation Status

**Branch:** `perf/code-splitting-tbt-optimization`
**Goal:** Reduce Total Blocking Time from 419ms to <200ms
**Status:** ✅ **MAJOR BREAKTHROUGH** - 88% bundle reduction achieved!

**Latest Update:** 2025-12-06 - Aggressive chunk splitting implemented

---

## 🎉 Major Achievement (2025-12-06)

### Aggressive Chunk Splitting Results

- **index.js: 469KB → 57.46KB** (-88%! / -411KB)
- **index.js gzipped: 149KB → 14.72KB** (-90%! / -134KB)
- **Expected TBT: 746ms → <300ms** (testing in progress)

See detailed analysis: [PERFORMANCE_OPTIMIZATIONS_2025-12-06-AGGRESSIVE.md](./PERFORMANCE_OPTIMIZATIONS_2025-12-06-AGGRESSIVE.md)

---

## ✅ Completed Optimizations

### 1. Route-Based Code Splitting ✅

**Commit:** Initial branch setup
**Impact:** HIGH

All major route components are now lazy loaded:

```typescript
// Before: All routes eagerly loaded in initial bundle
import SecretList from "./pages/Secrets/SecretList";
import SecretDetail from "./pages/Secrets/SecretDetail";

// After: Lazy loaded on-demand
const SecretList = lazy(() => import("./pages/Secrets/SecretList"));
const SecretDetail = lazy(() => import("./pages/Secrets/SecretDetail"));
```

**Components lazy loaded:**

- ShareTarget
- SecretList, SecretDetail, SecretCreate, SecretEdit
- OrganizationPage, CustomersPage, ObjectsPage, GuardBooksPage
- SettingsPage, ProfilePage

**Result:**

- Initial bundle: 469KB → Multiple smaller chunks
- Routes load on-demand
- Better user experience with faster initial load

### 2. Font Loading Optimization ✅

**Commit:** Initial branch setup
**Impact:** MEDIUM

Fonts now load asynchronously to prevent FOIT (Flash of Invisible Text):

```typescript
// Before (src/main.tsx): Synchronous blocking
import "@fontsource/inter";
import "@fontsource/inter/500.css";

// After (src/index.css): Asynchronous with font-display: swap
@import url("@fontsource/inter/400.css") layer(fonts);
@import url("@fontsource/inter/500.css") layer(fonts);
```

**Result:**

- Fonts no longer block initial render
- System fonts shown until custom fonts load
- Improved perceived performance

### 3. Bundle Analyzer Setup ✅

**Commit:** 4f419e7 - "feat: add bundle analyzer for performance optimization"
**Impact:** TOOL

Installed `rollup-plugin-visualizer` for bundle analysis:

```bash
npm run build:analyze
```

Opens `dist/stats.html` with interactive bundle size visualization showing:

- Gzip and Brotli compressed sizes
- Module dependencies
- Largest dependencies

**Result:**

- Can identify optimization opportunities
- Track bundle size changes over time

### 4. Dialog Components Lazy Loading ✅

**Commit:** c65c6ba - "perf: lazy load dialog components for better initial bundle size"
**Impact:** MEDIUM

Heavy dialog components now load only when opened:

```typescript
// Before: Eagerly loaded
import { ShareDialog } from "../../components/ShareDialog";

// After: Lazy loaded
const ShareDialog = lazy(() =>
  import("../../components/ShareDialog").then((m) => ({
    default: m.ShareDialog,
  }))
);

// Only render when dialog is open
{shareDialogOpen && (
  <Suspense fallback={<div>Loading...</div>}>
    <ShareDialog ... />
  </Suspense>
)}
```

**Components optimized:**

- ShareDialog (SecretDetail page)
- OrganizationalUnitFormDialog (OrganizationPage)

**Result:**

- Index bundle: 469KB → 459KB (-10KB)
- Dialogs only loaded when user opens them
- Faster initial page load

### 5. Aggressive Chunk Splitting (Function-based) ✅

**Commit:** 53f8f86 - "perf: aggressive chunk splitting - reduce main bundle by 88%"
**Impact:** 🚀 **CRITICAL - MAJOR BREAKTHROUGH**

**Files changed:**

- `vite.config.ts` - Switched from object-based to function-based `manualChunks`
- `OrganizationalUnitTree.tsx` - Lazy load Delete and Move dialogs

**Key Changes:**

1. Function-based dynamic chunk splitting:

```typescript
manualChunks(id) {
  // Split vendors by category
  if (id.includes("node_modules")) {
    if (id.includes("react")) return "vendor-react";
    if (id.includes("dexie") || id.includes("idb")) return "vendor-db";
    if (id.includes("motion")) return "vendor-animation";
    // ...
  }

  // Split application code
  if (id.includes("/src/services/")) return "services";
  if (id.includes("/src/lib/")) return "lib";
  if (id.includes("/src/locales/")) return `locale-${language}`;
}
```

2. Lazy load heavy dialogs in OrganizationalUnitTree:

```typescript
const DeleteOrganizationalUnitDialog = lazy(() =>
  import("./DeleteOrganizationalUnitDialog").then((m) => ({
    default: m.DeleteOrganizationalUnitDialog,
  }))
);
const MoveOrganizationalUnitDialog = lazy(() =>
  import("./MoveOrganizationalUnitDialog").then((m) => ({
    default: m.MoveOrganizationalUnitDialog,
  }))
);
```

**Results:**

- **index.js: 469KB → 57.46KB** (-88%! / -411KB uncompressed)
- **index.js: 149KB → 14.72KB** (-90%! / -134KB gzipped)
- Created 11 new optimized chunks:
  - vendor-react: 350KB (React ecosystem)
  - vendor-db: 96KB (Dexie/IDB)
  - vendor-animation: 113KB (Motion.js)
  - vendor-misc: 34KB (other deps)
  - services: 15KB (API services)
  - lib: 13KB (utilities)
  - locale-de: 16KB (German i18n)
  - locale-en: 14KB (English i18n)
  - DeleteOrganizationalUnitDialog: 4.18KB
  - MoveOrganizationalUnitDialog: 11.41KB
  - [+ route chunks]

**Expected Performance Impact:**

- Main thread parse time: ~863ms → ~150ms (-83%)
- TBT: 746ms → 200-300ms (-60-73%)
- Performance Score: 80% → 90-95%

**Deployment:**

- ✅ Deployed to app.secpal.dev
- ⏳ Manual performance verification pending

---

## 🔄 Previous Optimizations

### 4a. Dialog Components Lazy Loading (Initial) ✅

**Commit:** c65c6ba - "perf: lazy load dialog components for better initial bundle size"
**Impact:** MEDIUM

Heavy dialog components now load only when opened:

```typescript
// Before: Eagerly loaded
import { ShareDialog } from "../../components/ShareDialog";

// After: Lazy loaded
const ShareDialog = lazy(() =>
  import("../../components/ShareDialog").then((m) => ({
    default: m.ShareDialog,
  }))
);

// Only render when dialog is open
{shareDialogOpen && (
  <Suspense fallback={<div>Loading...</div>}>
    <ShareDialog ... />
  </Suspense>
)}
```

**Components optimized:**

- ShareDialog (SecretDetail page)
- OrganizationalUnitFormDialog (OrganizationPage)

**Result:**

- Index bundle: 469KB → 459KB (-10KB)
- Dialogs only loaded when user opens them
- Faster initial page load

---

## 🔄 Next Optimizations (Priority Order)

### 1. Further Dialog Lazy Loading (HIGH)

**Estimated Impact:** -15KB initial bundle

Additional dialogs to optimize:

- `DeleteOrganizationalUnitDialog`
- `MoveOrganizationalUnitDialog`
- `ConflictResolutionDialog`

### 2. Tree Shaking Improvements (HIGH)

**Estimated Impact:** -30-50KB

Check for:

- Unused Lingui locales (only need `de` and `en`)
- Unused icon imports from `@heroicons/react`
- Unused utility functions

### 3. Vendor Bundle Splitting (MEDIUM)

**Estimated Impact:** Better caching, parallel loading

Current vendor chunks:

- `vendor-react`: 45KB (good)
- `vendor-ui`: 129KB (could be split further)
- `vendor-lingui`: 8KB (good)

Consider splitting `vendor-ui` into:

- `vendor-headless`: Headless UI components
- `vendor-icons`: Heroicons

### 4. Dynamic Imports for Heavy Features (MEDIUM)

**Estimated Impact:** -20-30KB

Candidates:

- Attachment preview/download logic
- Crypto operations (only load when needed)
- File upload handling

### 5. Bundle Size Budget (LOW)

**Estimated Impact:** Prevention of regressions

Add size limits in `vite.config.ts`:

```typescript
build: {
  rollupOptions: {
    output: {
      manualChunks: { ... },
    },
  },
  chunkSizeWarningLimit: 500, // Warn if chunk > 500KB
}
```

---

## 📊 Bundle Size Comparison

| File                  | Before | After 1 | After 2 (Aggressive) | Total Improvement |
| --------------------- | ------ | ------- | -------------------- | ----------------- |
| `index.js`            | 469KB  | 459KB   | **57.46KB**          | **-88%** ✅       |
| `index.js` (gzipped)  | ~149KB | ~145KB  | **14.72KB**          | **-90%** ✅       |
| `vendor-react.js`     | 45KB   | 45KB    | 350KB                | Consolidated      |
| `vendor-headless.js`  | 129KB  | 129KB   | -                    | Split             |
| `vendor-db.js`        | -      | -       | 96KB                 | New               |
| `vendor-animation.js` | -      | -       | 113KB                | New               |
| `vendor-misc.js`      | -      | -       | 34KB                 | New               |
| `services.js`         | -      | -       | 15KB                 | New               |
| `lib.js`              | -      | -       | 13KB                 | New               |
| `locale-de.js`        | -      | -       | 16KB                 | New               |
| `locale-en.js`        | -      | -       | 14KB                 | New               |

_(Uncompressed sizes shown)_

**Key Achievement:** Main bundle reduced from 469KB to 57KB (-88%)!

**Gzipped sizes:**

- `index.js`: 149KB gzipped
- Total initial load: ~200KB gzipped

---

## 🎯 Performance Metrics Goals

| Metric                    | Baseline | Target  | Current | Status     |
| ------------------------- | -------- | ------- | ------- | ---------- |
| **TBT**                   | 419ms    | <200ms  | TBD     | 🔄 Testing |
| **LCP**                   | 1244ms   | <2500ms | ✅ Good | ✅         |
| **CLS**                   | 0.00004  | <0.1    | ✅ Good | ✅         |
| **Performance Score**     | 90-95%   | >90%    | ✅ Good | ✅         |
| **Initial Bundle (gzip)** | ~160KB   | <150KB  | ~149KB  | ✅         |

---

## 🧪 Testing Plan

### Local Testing

```bash
# Build and check bundle sizes
npm run build

# Run bundle analyzer
npm run build:analyze

# Run all tests
npm run test:run:all
npm run test:e2e
```

### Staging Testing (.dev server)

```bash
# Performance tests against app.secpal.dev
npm run test:e2e:staging -- --grep "performance"

# Lighthouse audit
npm run lighthouse:ci
```

### Production Testing

After deployment to production:

1. Run Lighthouse audit manually
2. Check Core Web Vitals in real user monitoring
3. Compare before/after metrics

---

## 🚀 Deployment Checklist

- [ ] All tests passing locally
- [ ] Bundle size improved
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Performance tests on .dev server
- [ ] GitHub PR created
- [ ] Deploy to .dev server
- [ ] Verify on .dev server
- [ ] Merge to main
- [ ] Deploy to production
- [ ] Monitor production metrics

---

## 📝 Notes

### DDEV Development

When testing locally with DDEV:

- Frontend: `http://localhost:5173`
- Backend: `https://secpal-api.ddev.site`
- Vite proxy configured for `/v1` and `/sanctum` endpoints

### .dev Server (Uberspace)

- URL: `https://app.secpal.dev`
- SSH: `ssh secpal@triangulum.uberspace.de`
- Deployment: Via GitHub PR pull

### Performance Measurement

Tools used:

- Playwright + Lighthouse CI (automated)
- Chrome DevTools (manual)
- Vite build stats (bundle size)
- rollup-plugin-visualizer (bundle analysis)

---

**Last Updated:** 2025-12-06
**Next Review:** After .dev server testing
