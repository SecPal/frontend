<!--
SPDX-FileCopyrightText: 2025 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Performance: Defer Non-Critical JavaScript (TBT Optimization)

**Date:** 2025-12-06
**Issue:** #319
**Branch:** `perf/tbt-defer-non-critical`
**Status:** Implementation Complete

---

## Overview

This document describes the implementation of HIGH IMPACT optimizations to reduce Total Blocking Time (TBT) by deferring non-critical JavaScript initialization.

**Target:** Reduce TBT from 384ms to <200ms (184ms gap)
**Expected Impact:** -50-80ms TBT reduction

---

## Implemented Optimizations

### 1. ⚡ Defer Service Worker Registration (-20-30ms)

**Problem:** Service Worker registration blocks the main thread during initial page load

**Solution:** Delay SW registration by 3 seconds using manual registration

**Changes:**

#### `vite.config.ts`

```typescript
VitePWA({
  // ... other config
  injectRegister: false, // Manual registration with delay
});
```

#### `src/main.tsx`

```typescript
// Defer Service Worker registration by 3 seconds
setTimeout(() => {
  if ("serviceWorker" in navigator) {
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        registerSW({
          immediate: true,
          onRegistered(registration) {
            console.log("[SW] Service Worker registered with deferred timing");
            // ... update check logic
          },
        });
      })
      .catch((error) => {
        console.error("[SW] Failed to import PWA register:", error);
      });
  }
}, 3000);
```

**Why 3 seconds?**

- Allows FCP (First Contentful Paint) and LCP (Largest Contentful Paint) to complete
- User sees content quickly without SW registration blocking render
- SW still registers early enough for offline capabilities

**Trade-offs:**

- ✅ Better initial page load performance
- ✅ Reduced TBT significantly
- ⚠️ 3-second delay before offline capabilities are available
- ⚠️ Update checks delayed by 3 seconds

---

### 2. ⚡ Defer Web Vitals Monitoring (-10-20ms)

**Problem:** Web Vitals library initializes immediately, blocking main thread

**Solution:** Use `requestIdleCallback` to defer initialization until main thread is idle

**Changes:**

#### `src/main.tsx`

```typescript
// Defer Web Vitals initialization to reduce TBT
if ("requestIdleCallback" in window) {
  requestIdleCallback(() => {
    initWebVitals();
  });
} else {
  setTimeout(() => {
    initWebVitals();
  }, 1000);
}
```

**Why `requestIdleCallback`?**

- Browser-native API for scheduling work when main thread is idle
- Guarantees Web Vitals won't block critical rendering
- Falls back to `setTimeout(1000)` for browsers without support (Safari)

**Trade-offs:**

- ✅ No impact on initial page load performance
- ✅ Web Vitals still captured accurately
- ⚠️ Analytics data delayed by 1-3 seconds

---

## Verification

### Manual Testing

1. **Dev Server:**

   ```bash
   npm run dev
   ```

2. **Chrome DevTools:**
   - Open Performance tab
   - Record page load
   - Verify Service Worker registration happens after ~3 seconds
   - Verify Web Vitals initialization happens in idle callback

### Lighthouse Testing

```bash
# Build production bundle
npm run build

# Preview production build
npm run preview

# Run Lighthouse audit
npm run test:e2e:staging -- tests/e2e/performance.spec.ts
```

**Expected Results:**

| Metric | Before | Expected After | Improvement |
| ------ | ------ | -------------- | ----------- |
| TBT    | 384ms  | ~300-330ms     | -54-84ms    |

---

## Known Issues

### Service Worker Update Hook

The `useServiceWorkerUpdate` hook no longer needs to handle SW registration timing, as this is now done manually in `main.tsx`. The hook still handles:

- Update prompts
- Manual update triggers
- Hourly update checks

### Test Compatibility

Tests that mock `useRegisterSW` may need updates if they expect immediate registration.

---

## Next Steps

### Additional Optimizations (Phase 2)

If TBT target (<200ms) is not met with Phase 1, implement:

1. **Locale Splitting (-15-20ms)**
   - Dynamic import for language files
   - Only load selected locale

2. **Lazy Load Heavy Dialogs (-20-30ms)**
   - ✅ Already done: `DeleteOrganizationalUnitDialog`, `MoveOrganizationalUnitDialog`
   - Potential: `ShareDialog`, other modal components

3. **Motion.js Lazy Loading (-20-40ms)**
   - Currently loaded eagerly in `navbar.tsx` and `sidebar.tsx`
   - Consider lazy loading or removing if not critical

### React Optimizations (Phase 3)

If Phases 1-2 insufficient:

- React Profiler analysis
- Component memoization audit
- Virtual scrolling for long lists
- Suspense/Transitions for heavy renders

---

## References

- [Issue #319](https://github.com/SecPal/frontend/issues/319)
- [PERFORMANCE_TBT_ANALYSIS.md](./PERFORMANCE_TBT_ANALYSIS.md)
- [Web.dev - Optimize TBT](https://web.dev/articles/tbt)
- [MDN - requestIdleCallback](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestIdleCallback)
- [vite-plugin-pwa Docs](https://vite-pwa-org.netlify.app/)

---

## Author

@kevalyq

**Last Updated:** 2025-12-06
