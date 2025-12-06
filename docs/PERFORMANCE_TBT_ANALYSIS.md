<!--
SPDX-FileCopyrightText: 2025 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Total Blocking Time (TBT) Analysis & Optimization Strategy

**Date:** 2025-12-06  
**Context:** PR #318 Performance Optimization  
**Current TBT:** 384ms (Target: <200ms, Gap: +184ms)

---

## Executive Summary

Bundle size reduction (-37%) yielded only minimal TBT improvement (-8%). Root cause: **TBT is dominated by JavaScript parse/execution time**, not transfer size.

### Key Metrics
| Metric | Before (PR #317) | After (PR #318) | Change | Target | Status |
|--------|------------------|-----------------|--------|--------|--------|
| Bundle Size (gzipped) | 149KB | 94KB | -37% | - | ✅ |
| TBT | 419ms | 384ms | -8% (-35ms) | <200ms | ❌ |
| Performance Score | ~90 | 94/100 | +4% | >90 | ✅ |
| LCP | ~1200ms | 1216ms | 0% | <2500ms | ✅ |
| CLS | ~0.00004 | 0.00004 | 0% | <0.1 | ✅ |

**Conclusion:** Bundle splitting alone is insufficient. Need JavaScript execution optimizations.

---

## Root Cause Analysis

### What is TBT?
Total Blocking Time measures the total amount of time between First Contentful Paint (FCP) and Time to Interactive (TTI) where the main thread was blocked for long enough to prevent input responsiveness.

### Why Bundle Size ≠ TBT Improvement?
1. **Parse Time:** Modern browsers parse JavaScript very fast (~1-2ms per 100KB)
2. **Execution Time:** The bottleneck is **running** the code (React mounting, component initialization, etc.)
3. **Main Thread Blocking:** Large component trees, heavy computations, synchronous operations

### Current Bundle Composition
```
Main Bundle (94KB gzipped):
- React components (eager loaded)
- Both locale files (de: 16KB, en: 13KB) - loaded upfront
- Application logic
- Route definitions
- Context providers

Vendor Chunks (loaded in parallel):
- vendor-ui: 128KB (41KB gzipped) - Headless UI + Heroicons
- vendor-db: 97KB (32KB gzipped) - Dexie + IDB  
- vendor-animation: 56KB (20KB gzipped) - Motion.js
- vendor-react: 45KB (16KB gzipped) - React + ReactDOM
```

---

## Optimization Strategies (Prioritized)

### 1. ⚡ HIGH IMPACT: Defer Non-Critical JavaScript

**Goal:** Reduce initial parse/execute workload by deferring non-critical features

**Implementation:**
```typescript
// Defer heavy components until after initial render
const HeavyComponent = lazy(() => import('./HeavyComponent'));

// Use requestIdleCallback for non-critical initialization
if ('requestIdleCallback' in window) {
  requestIdleCallback(() => {
    // Initialize analytics, monitoring, etc.
  });
}
```

**Candidates for Deferral:**
- ✅ Route components (already lazy loaded)
- ⏳ Dialog components (lazy load on-demand)
- ⏳ Animation library (Motion.js) - only load when needed
- ⏳ Web Vitals monitoring - defer until after TTI
- ⏳ Service Worker registration - defer 2-3 seconds

**Expected Impact:** -50-100ms TBT

### 2. ⚡ MEDIUM IMPACT: Locale Splitting (On-Demand Loading)

**Problem:** Both locale files (de + en = ~30KB) are loaded upfront, but only one is used

**Solution:** Dynamic import based on user's language preference
```typescript
// Current (eager): Both locales bundled
import deMessages from './locales/de/messages.mjs';
import enMessages from './locales/en/messages.mjs';

// Optimized (lazy): Only load selected locale
const messages = await import(`./locales/${locale}/messages.mjs`);
```

**Expected Impact:** -15-20ms TBT, -15KB initial download

**Status:** Attempted but caused build hang with function-based `manualChunks`. 
Need alternative approach using Vite's `dynamicImportVarsOptions`.

### 3. ⚡ MEDIUM IMPACT: Code Splitting for Heavy Dialogs

**Problem:** All dialogs eagerly loaded even if never opened

**Candidates:**
- `ShareDialog` (4KB)
- `DeleteOrganizationalUnitDialog` (4.3KB)
- `MoveOrganizationalUnitDialog` (11.5KB)
- `OrganizationalUnitFormDialog` (5.4KB)

**Implementation:**
```typescript
// Instead of: import { ShareDialog } from './components/ShareDialog';
const ShareDialog = lazy(() => import('./components/ShareDialog'));

// Wrap in Suspense with fallback
<Suspense fallback={<DialogSkeleton />}>
  {showDialog && <ShareDialog {...props} />}
</Suspense>
```

**Expected Impact:** -20-30ms TBT

### 4. 🔍 LOW IMPACT: Tree Shaking & Dead Code Elimination

**Analysis Needed:**
- Unused exports from vendor libraries
- Unused Heroicons (currently imports entire library)
- Unused Lingui features

**Tools:**
- `npx vite-bundle-visualizer` - identify large modules
- Webpack Bundle Analyzer alternative for Vite
- Chrome DevTools Coverage tab

**Expected Impact:** -10-20ms TBT

### 5. 🔍 LOW IMPACT: Font Loading Optimization

**Current:** 60+ font files (Inter font family, multiple weights/languages)

**Problem:** Font loading can block rendering

**Solutions:**
- Subset fonts to only include used glyphs
- Use `font-display: swap` (already implemented via Fontsource)
- Preload critical fonts
- Remove unused font weights/languages (Greek, Cyrillic, Vietnamese if not needed)

**Expected Impact:** -5-10ms TBT (mostly affects LCP, not TBT)

---

## Immediate Next Steps (For PR #318)

### Option A: Ship Current Improvements ✅
- Bundle size: -37% improvement ✅
- Performance Score: 94/100 ✅
- TBT: 384ms (improved from 419ms, but still over target)
- Document findings and plan follow-up PR for remaining optimizations

### Option B: Implement Quick Wins Before Merge ⏳
1. Defer Service Worker registration (+2-3s delay)
2. Defer Web Vitals initialization (requestIdleCallback)
3. Lazy load ShareDialog and Move/DeleteOUDialog
4. Expected total impact: -50-80ms TBT → ~300-330ms (still over target)

### Option C: Deep Dive (Separate Epic) 🎯
- React Profiler analysis to identify slow components
- Implement React Concurrent Features (Suspense, Transitions)
- Virtual scrolling for long lists
- Memoization audit (useMemo, React.memo)
- Expected impact: -100-150ms TBT → ~230-280ms

---

## Measurement & Validation

**Test Command:**
```bash
npm run test:e2e:staging -- tests/e2e/performance.spec.ts
```

**Lighthouse CI:**
```bash
npm run lighthouse:ci
```

**Manual Testing:**
1. Chrome DevTools → Performance Tab
2. Record page load
3. Identify long tasks (>50ms)
4. Focus on tasks between FCP and TTI

---

## References

- [Web.dev - Optimize TBT](https://web.dev/articles/tbt)
- [Chrome DevTools - Performance](https://developer.chrome.com/docs/devtools/performance/)
- [React Lazy Loading](https://react.dev/reference/react/lazy)
- [Vite Code Splitting](https://vite.dev/guide/build.html#chunking-strategy)

---

## Conclusion

Bundle size optimization was successful (-37%) but insufficient for TBT target. The remaining 184ms gap requires:
1. Deferred initialization of non-critical features
2. Lazy loading of heavy components
3. Potential React rendering optimizations

**Recommendation:** Merge current improvements, create follow-up Epic for remaining TBT optimization work.
