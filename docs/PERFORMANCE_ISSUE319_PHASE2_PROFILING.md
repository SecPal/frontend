<!--
SPDX-FileCopyrightText: 2025 SecPal
SPDX-License-Identifier: AGPL-3.0-or-later
-->

# Performance Issue #319 - Phase 2: React Profiling Session

**Status:** 🔄 IN PROGRESS
**Date:** 2025-01-XX
**Goal:** Identify React rendering bottlenecks causing TBT >373ms

---

## Profiling Setup

### Tools

1. **React DevTools Profiler** (Chrome Extension)
2. **Chrome Performance Tab** (Lighthouse Trace)
3. **Production Build Analysis**

### Environment

- Branch: `perf/react-optimization-phase2`
- Build: Production with source maps
- Test URL: `app.secpal.dev`

---

## Initial Code Analysis

### SecretList Component (`src/pages/Secrets/SecretList.tsx`)

**Complexity:** HIGH (381 lines)

#### Rendering Logic

```typescript
// Already uses useMemo for expensive filters (✅ OPTIMIZED)
const filteredSecrets = useMemo(() => {
  return secrets.filter((secret) => {
    // Search, tag, expiration filters
  });
}, [secrets, searchQuery, selectedTag, expirationFilter]);

// Already uses useMemo for pagination (✅ OPTIMIZED)
const paginatedSecrets = useMemo(() => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  return filteredSecrets.slice(startIndex, endIndex);
}, [filteredSecrets, currentPage, itemsPerPage]);
```

#### Child Components

- **SecretCard** (mapped over `paginatedSecrets`)
  - Re-renders on every `SecretList` state change
  - ❌ NOT memoized
  - Contains: date calculations, conditional rendering
  - Frequency: 20 cards per page

**Optimization Opportunity:** Wrap `SecretCard` in `React.memo`

---

### SecretCard Component (`src/pages/Secrets/SecretCard.tsx`)

**Complexity:** LOW (94 lines)

#### Rendering Logic

```typescript
// Calculates expiration status on EVERY render (❌ NOT OPTIMIZED)
const now = new Date();
const expires = secret.expires_at ? new Date(secret.expires_at) : null;
const isExpired = expires && expires < now;
const isExpiringSoon =
  !isExpired && expires && expires < new Date(now.getTime() + EXPIRING_SOON_MS);
```

**Problem:**

- Creates new `Date()` on every render
- Performs date calculations for EACH card (20x per page)
- Re-renders when parent state changes (filter, viewMode, etc.)

**Optimization Opportunities:**

1. Memoize with `React.memo` (prevent unnecessary re-renders)
2. Move date calculations to `useMemo` (prevent recalculation)

---

### OrganizationalUnitTree Component (`src/components/OrganizationalUnitTree.tsx`)

**Complexity:** VERY HIGH (860 lines)

#### Rendering Logic

- Recursive tree structure with `TreeNode` components
- Uses `useState` and `useCallback` (✅ partially optimized)
- Lazy loads dialogs (✅ optimized)

#### TreeNode Component

```typescript
function TreeNode({
  unit,
  level,
  onSelect,
  onEdit,
  onDelete,
  onMove,
  onCreateChild,
  selectedId,
}: TreeNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2);
  const hasChildren = unit.children && unit.children.length > 0;
  const isSelected = selectedId === unit.id;

  // Uses useCallback for handlers (✅ OPTIMIZED)
  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setIsExpanded(!isExpanded);
    },
    [isExpanded]
  );

  // ... more handlers
}
```

**Problem:**

- `TreeNode` is not memoized
- Re-renders entire tree when any node expands/collapses
- Complex prop passing through tree levels

**Optimization Opportunity:**

- Wrap `TreeNode` in `React.memo` with custom comparison function

---

## Phase 2 Implementation Plan

### Step 1: Memoize SecretCard ⏳

**File:** `src/pages/Secrets/SecretCard.tsx`

```typescript
import { memo, useMemo } from "react";

export const SecretCard = memo(function SecretCard({
  secret,
}: SecretCardProps) {
  // Move date calculations to useMemo
  const expirationStatus = useMemo(() => {
    const now = new Date();
    const expires = secret.expires_at ? new Date(secret.expires_at) : null;
    const isExpired = expires && expires < now;
    const isExpiringSoon =
      !isExpired &&
      expires &&
      expires < new Date(now.getTime() + EXPIRING_SOON_MS);
    return { isExpired, isExpiringSoon };
  }, [secret.expires_at]);

  const { isExpired, isExpiringSoon } = expirationStatus;

  // ... rest of component
});
```

**Expected Impact:** -10-20ms TBT (prevent 20 card re-renders per filter change)

---

### Step 2: Memoize TreeNode ⏳

**File:** `src/components/OrganizationalUnitTree.tsx`

```typescript
const TreeNode = memo(
  function TreeNode({ unit, level /* ... */ }: TreeNodeProps) {
    // ... existing implementation
  },
  (prevProps, nextProps) => {
    // Custom comparison: only re-render if unit changes or selection changes
    return (
      prevProps.unit === nextProps.unit &&
      prevProps.selectedId === nextProps.selectedId &&
      prevProps.level === nextProps.level
    );
  }
);
```

**Expected Impact:** -20-30ms TBT (prevent cascading tree re-renders)

---

### Step 3: Audit useMemo/useCallback Usage ⏳

**Target Files:**

- `src/pages/Secrets/SecretList.tsx` ✅ (already optimized)
- `src/pages/Organization/ObjectsPage.tsx` ⏳
- `src/components/ApplicationLayout.tsx` ⏳
- `src/components/navbar.tsx` ⏳

---

### Step 4: Virtual Scrolling (IF NEEDED) ⏳

**Condition:** If TBT still >250ms after memoization

**Library:** `@tanstack/react-virtual`

**Target Components:**

- `SecretList` (if >100 secrets displayed)
- `OrganizationalUnitTree` (if >50 nodes)

---

## Next Steps

1. Implement Step 1 (SecretCard memoization)
2. Run Lighthouse tests to measure impact
3. Implement Step 2 if TBT still >250ms
4. Continue until TBT <200ms

---

## References

- **Issue:** #319
- **Previous PR:** #320 (Phase 1 - FAILED)
- **Status Doc:** `docs/PERFORMANCE_ISSUE319_STATUS.md`
