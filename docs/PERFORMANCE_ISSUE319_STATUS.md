<!--
SPDX-FileCopyrightText: 2025 SecPal Contributors
SPDX-License-Identifier: CC0-1.0
-->

# Performance Optimization Progress - Issue #319

**Date:** 2025-12-06
**Status:** Phase 1 Complete - Awaiting Lighthouse Verification

---

## Implementation Summary

### ✅ Phase 1: HIGH IMPACT Optimizations (COMPLETED)

**PR #320** - Defer Non-Critical JavaScript

**Changes:**

1. **Service Worker Registration Defer (-20-30ms expected)**
   - Changed `injectRegister: false` in `vite.config.ts`
   - Manual registration with 3-second delay in `main.tsx`
   - Allows FCP/LCP to complete first

2. **Web Vitals Monitoring Defer (-10-20ms expected)**
   - Use `requestIdleCallback` for initialization
   - Falls back to `setTimeout(1000)` for Safari
   - Non-blocking analytics tracking

**Expected Impact:**

- TBT: 384ms → ~300-330ms (-50-80ms)
- Still **100-130ms over target** (<200ms)

**Files Changed:**

- `src/main.tsx` (+49 lines)
- `vite.config.ts` (+3 lines)
- `docs/PERFORMANCE_TBT_DEFER_IMPLEMENTATION.md` (+214 lines)

---

## Already Optimized (Previous Work)

✅ **Dialog Lazy Loading** (from OrganizationalUnitTree.tsx)

- `DeleteOrganizationalUnitDialog` - lazy loaded
- `MoveOrganizationalUnitDialog` - lazy loaded

✅ **Locale Dynamic Import** (from i18n.ts)

- Language files loaded on-demand: `import('./locales/${locale}/messages.mjs')`

✅ **Route Lazy Loading** (from App.tsx)

- All route components lazy loaded except Login page

✅ **Bundle Splitting** (PR #318)

- 7 vendor chunks for better caching
- Main bundle: 310KB → 94KB gzipped (-37%)

---

## Phase 2: Additional Optimizations (IF NEEDED)

### ❌ Phase 1 Failed: Defer Strategy Counterproductive

**PR #320 CLOSED** - Performance regression detected

**Test Results:**

- Baseline (main): TBT 373ms
- With defer strategy: TBT 405ms (+32ms, +8.6% worse)

**Why it failed:**

1. Dynamic import overhead outweighed benefits
2. 3s delay moved SW registration into TBT measurement window
3. requestIdleCallback didn't reduce blocking time
4. **Key Learning:** TBT is dominated by React rendering, not initialization

### ✅ Phase 2: React Performance Optimization (CURRENT)

**Strategy:** Focus on React rendering performance

**Approach:**

1. **React DevTools Profiler Analysis**
   - Identify slow-rendering components
   - Find unnecessary re-renders
   - Measure actual component render times

2. **Component Memoization Audit**
   - Audit `useMemo`, `useCallback` usage
   - Wrap expensive components in `React.memo`
   - Prevent cascading re-renders

3. **Virtual Scrolling (if needed)**
   - For Secret List (if >100 items tested)
   - For Organizational Unit Tree
   - Use `@tanstack/react-virtual`

### Implementation Plan

#### Step 1: Profiling Session

**Tools:**

- React DevTools Profiler
- Chrome Performance tab

**Actions:**

- Identify slow components
- Audit `useMemo`, `React.memo` usage
- Check for unnecessary re-renders

### 2. Virtual Scrolling

**For:** Secret List, Organizational Unit Tree

**Library:** `@tanstack/react-virtual`

**Impact:** -20-50ms for lists with 100+ items

### 3. Component Memoization

**Candidates:**

- `SecretCard` in secret list
- `OrganizationalUnitNode` in tree
- Any components re-rendering on unrelated state changes

---

## NOT Implemented (Reasons)

❌ **Motion.js Lazy Loading**

- Used in `navbar.tsx` and `sidebar.tsx` for navigation animations
- Part of critical UI (always visible)
- Lazy loading would cause animation "jump"
- Already in separate vendor chunk (56KB / 20KB gzipped)

---

## Testing Plan

### 1. Local Testing

```bash
npm run build
npm run preview
```

- Verify Service Worker registers after 3 seconds
- Verify Web Vitals init in idle callback
- Ensure no console errors

### 2. Staging Deployment

```bash
# Deploy to app.secpal.dev
./scripts/deploy-to-dev.sh
```

### 3. Lighthouse Audit

```bash
npm run test:e2e:staging -- tests/e2e/performance.spec.ts
```

**Success Criteria:**

- TBT <200ms ✅
- Performance Score ≥90 ✅
- No LCP/CLS regression ✅

---

## Decision Tree

```text
Phase 1 TBT Result:
├─ <200ms → ✅ Close issue #319
├─ 200-250ms → Consider Phase 2 optimizations
├─ 250-300ms → Implement Phase 2 (React profiling)
└─ >300ms → Deep investigation needed
```

---

## References

- **Issue:** #319
- **PR:** #320 (Draft)
- **Analysis:** `docs/PERFORMANCE_TBT_ANALYSIS.md`
- **Implementation:** `docs/PERFORMANCE_TBT_DEFER_IMPLEMENTATION.md`
- **Previous PR:** #318 (Bundle size optimization)

---

## Next Actions

1. **Merge PR #320** once Copilot review is clean
2. **Deploy to staging** (app.secpal.dev)
3. **Run Lighthouse audit**
4. **Evaluate results**:
   - If TBT <200ms: Close issue, celebrate 🎉
   - If TBT ≥200ms: Proceed to Phase 2

---

**Author:** @kevalyq
**Last Updated:** 2025-12-06
