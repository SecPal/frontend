<!--
SPDX-FileCopyrightText: 2025 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# PWA Phase 3 - Testing Guide

## 🧪 Features to Test

This document describes how to test the new PWA Phase 3 features locally.

---

## 📋 Prerequisites

1. **Backend (API) running via DDEV**

   ```bash
   cd /home/user/code/SecPal/api
   ddev start
   ddev describe
   # Should show: https://secpal-api.ddev.site
   ```

2. **Frontend running on localhost**

   ```bash
   cd /home/user/code/SecPal/frontend
   npm run dev
   # Runs on: http://localhost:5173
   ```

3. **Environment variable configured**
   - `.env.local` contains: `VITE_API_URL=https://secpal-api.ddev.site`

---

## 🔔 Feature 1 - Push Notifications

### What It Includes

- Notification Permission Management
- Service Worker Push Notifications
- Notification Preference UI with Catalyst Components
- LocalStorage for preferences

### How to Test Push Notifications

1. **Open the app** in Chrome/Edge (Firefox has different permission UX)

2. **Navigate to Notification Settings Page**
   - If not yet available, temporarily add a route:

     ```tsx
     // In App.tsx or Router
     <Route path="/notifications" element={<NotificationPreferences />} />
     ```

3. **Test Permission Request**
   - Click "Enable Notifications"
   - Browser shows permission dialog
   - After "Allow": Welcome notification appears

4. **Test Preferences**
   - Toggle switches for different categories:
     - Security Alerts
     - System Updates
     - Shift Reminders
     - Team Messages
   - Click "Send Test" → Test notification appears
   - Open DevTools → Application → Storage → Local Storage
   - Check: `secpal-notification-preferences` key

5. **Service Worker Check**

   ```bash
   # Chrome DevTools → Application → Service Workers
   # Status should be "activated and is running"
   ```

### Push Notifications - Success Criteria

- ✅ Permission dialog appears on first interaction
- ✅ Welcome notification on grant
- ✅ Catalyst switches work smoothly
- ✅ Test notification appears with icon
- ✅ Preferences saved in localStorage

---

## 📤 Feature 2 - Share Target API

### Share Target Components

- PWA Manifest Share Target Config
- URL Parameter Parsing
- Shared Data Hook (`useShareTarget`)

### How to Test Share Target

1. **Install PWA**

   ```bash
   # Chrome: Address bar → "Install" icon
   # Or: DevTools → Application → Manifest → "Install"
   ```

2. **Share from another app**
   - **Option A (Desktop):** Right-click on image → "Share" → Select SecPal
   - **Option B (Mobile):** Browser share button → Select SecPal
   - **Option C (Test URL):** Manually open:

     ```text
     http://localhost:5173/share?title=Test&text=Hello&url=https://example.com
     ```

3. **Test hook integration**

   ```tsx
   // In a component:
   const { sharedData, isSharing, clearSharedData } = useShareTarget();

   useEffect(() => {
     if (sharedData) {
       console.log("Shared data:", sharedData);
       // Handle: sharedData.title, sharedData.text, sharedData.url
       clearSharedData();
     }
   }, [sharedData]);
   ```

### Share Target - Success Criteria

- ✅ SecPal appears in OS share menu
- ✅ App opens with `/share` route
- ✅ `useShareTarget` detects shared data
- ✅ URL is cleaned to `/` after processing

---

## 📊 Feature 3 - Offline Analytics

### Analytics Components

- Privacy-First Event Tracking
- IndexedDB Persistence
- Automatic Sync when online
- Session ID Generation

### How to Test Analytics

1. **Use the Analytics SDK**

   ```tsx
   import { getAnalytics } from "@/lib/analytics";

   // In components:
   try {
     const analytics = getAnalytics();
     await analytics.trackPageView("/dashboard", "Dashboard");
     await analytics.trackClick("login-button", { form: "login" });
     await analytics.trackFormSubmit("login-form", true);
     await analytics.trackError(new Error("Test error"));
   } catch (error) {
     console.error("Analytics not available:", error);
   }
   ```

2. **Check IndexedDB**

   ```bash
   # Chrome DevTools → Application → Storage → IndexedDB
   # Database: SecPalDB
   # Table: analytics
   # Check events with synced=false
   ```

3. **Test offline tracking**

   ```bash
   # DevTools → Network → Toggle "Offline"
   # Trigger some events (Page Views, Clicks)
   # Check IndexedDB: Events should be stored
   # DevTools → Network → Toggle "Online"
   # Wait up to 5 minutes OR come online → Events will sync automatically
   # (Coming online triggers immediate sync)
   ```

4. **Get stats**

   ```tsx
   const stats = await analytics.getStats();
   console.log(stats);
   // {
   //   total: 45,
   //   synced: 30,
   //   unsynced: 15,
   //   byType: { page_view: 20, button_click: 25 }
   // }
   ```

### Analytics - Success Criteria

- ✅ Events are stored in IndexedDB
- ✅ Session ID remains constant during session
- ✅ Offline events sync when online
- ✅ Synced events have `synced: true`
- ✅ Console shows "Syncing X analytics events..."

---

## 🧪 Automated Tests

All features have comprehensive tests:

```bash
cd /home/user/code/SecPal/frontend

# Run all tests
npm test -- --run

# Run specific test suites
npm test -- useNotifications.test.ts --run
npm test -- useShareTarget.test.ts --run
npm test -- analytics.test.ts --run
npm test -- NotificationPreferences.test.tsx --run

# With coverage
npm test -- --coverage
```

### Test Results Summary

- ✅ 131/131 tests passing
- ✅ No TypeScript errors
- ✅ Coverage >80%

---

## 🎨 Catalyst Components Validation

Check that **NotificationPreferences** correctly uses Catalyst:

```bash
# DevTools → Elements → Inspect NotificationPreferences
# Check classes:
# - Button: "relative isolate inline-flex..." (Catalyst)
# - Switch: "group relative isolate inline-flex h-6..." (Catalyst)
# - Fieldset: "*:data-[slot=text]:mt-1..." (Catalyst)
# - Text: "text-base/6 text-zinc-500..." (Catalyst)
```

### Tailwind Usage

No custom Tailwind except:

- Layout utilities: `flex`, `gap-4`, `space-y-6`
- Inline alerts: `bg-blue-50`, `p-4` (acceptable - no Catalyst alternative)

---

## 🔧 Troubleshooting

### Notifications Not Working

How to fix:

1. Check browser support: Chrome/Edge/Safari (not Firefox Developer Edition)
2. HTTPS required (localhost is OK, but not `file://`)
3. Check browser permissions: `chrome://settings/content/notifications`
4. Service Worker status: DevTools → Application → Service Workers

### Share Target Not Appearing

How to fix:

1. PWA **must be installed** (not just in browser tab)
2. Check manifest: DevTools → Application → Manifest → `share_target` should be visible
3. Re-install PWA after manifest changes
4. Only works on HTTPS or localhost

### Analytics Events Not Syncing

How to fix:

1. Check online status: `navigator.onLine` in Console
2. Open IndexedDB: DevTools → Application → IndexedDB → SecPalDB → analytics
3. Check console logs: "Syncing X analytics events..."
4. Backend endpoint missing (TODO in code → currently only local marking)

### DDEV Backend Not Reachable

How to fix:

```bash
# Check DDEV status
cd /home/user/code/SecPal/api
ddev describe

# If stopped:
ddev start

# Restart frontend (to load .env.local)
cd /home/user/code/SecPal/frontend
npm run dev
```

---

## 📝 Next Steps After Testing

1. ✅ All features manually tested
2. ✅ All automated tests passing
3. ✅ Catalyst components validated
4. ✅ DDEV config working
5. 🚀 **Create PR** with Issue #67 reference

---

## 🔗 Related Files

### New Features

- `src/hooks/useNotifications.ts` - Push Notification Hook
- `src/hooks/useShareTarget.ts` - Share Target Hook
- `src/lib/analytics.ts` - Offline Analytics Singleton
- `src/components/NotificationPreferences.tsx` - UI with Catalyst

### Tests

- `src/hooks/useNotifications.test.ts` (13 tests)
- `src/hooks/useShareTarget.test.ts` (11 tests)
- `src/lib/analytics.test.ts` (22 tests)
- `src/components/NotificationPreferences.test.tsx` (15 tests)

### Configuration

- `vite.config.ts` - Share Target Manifest
- `src/lib/db.ts` - Analytics Table (Schema v2)
- `.env.local` - DDEV API URL

---

Happy testing! 🎉
