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

## 🔄 Feature 0 - PWA Update Notifications

### PWA Update Components

- Service Worker update detection with `registerType: 'prompt'`
- `useServiceWorkerUpdate` hook for managing updates
- `UpdatePrompt` component with Catalyst Design System
- Automatic hourly update checks
- User-controlled update installation

### How to Test PWA Updates

#### Testing with Production Build

1. **Build the app**

   ```bash
   cd /home/user/code/SecPal/frontend
   npm run build
   npm run preview
   # Opens on: http://localhost:4173
   ```

2. **Open app in browser**
   - Chrome/Edge recommended for testing
   - Open <http://localhost:4173>

3. **Simulate a code change**
   - Make a small change in `src/App.tsx` (e.g., change a text)
   - Rebuild: `npm run build`
   - Preview should auto-reload with new build

4. **Trigger update check**
   - Wait for automatic check (happens every hour)
   - OR manually trigger:
     - DevTools → Application → Service Workers → "Update" button
     - OR refresh the page

5. **Verify Update Prompt appears**
   - Alert appears in bottom-right corner
   - Title: "New version available"
   - Description: "A new version of SecPal is ready..."
   - Two buttons: "Update" and "Later"

6. **Test "Update" button**
   - Click "Update"
   - Page reloads automatically
   - New version is active

7. **Test "Later" button**
   - Make another change → rebuild
   - Trigger update check again
   - Click "Later"
   - Prompt disappears
   - App continues with current version
   - New version will be offered again after 1 hour (snooze period)

#### Testing in Development

Note: Service Worker updates work differently in `npm run dev`:

- Vite's HMR (Hot Module Replacement) takes precedence
- Service Worker may not register in dev mode
- Use production build (`npm run build && npm run preview`) for realistic testing

### PWA Update Notifications - Success Criteria

- ✅ Update prompt appears when new version is detected
- ✅ "Update" button reloads page with new version
- ✅ "Later" button dismisses prompt without updating
- ✅ Prompt is accessible (ARIA attributes, keyboard navigation)
- ✅ Automatic hourly update checks work
- ✅ No automatic reload (user controls when to update)
- ✅ Prompt positioned bottom-right, non-intrusive

---

## 🔔 Feature 1 - Push Notifications

### Push Notifications Overview

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

- PWA Manifest Share Target Config (GET + POST methods)
- URL Parameter Parsing (GET method - text only)
- FormData Parsing (POST method - files + text)
- Service Worker File Processing
- Shared Data Hook (`useShareTarget`)
- File Preview and Validation

### How to Test Share Target

#### Method 1: Text Sharing (GET - Simple)

1. **Install PWA**

   ```bash
   # Chrome: Address bar → "Install" icon
   # Or: DevTools → Application → Manifest → "Install"
   ```

2. **Share text from another app**
   - **Option A (Desktop):** Right-click on text/link → "Share" → Select SecPal
   - **Option B (Mobile):** Browser share button → Select SecPal
   - **Option C (Test URL):** Manually open:

     ```text
     http://localhost:5173/share?title=Test&text=Hello&url=https://example.com
     ```

3. **Verify text display**
   - App opens at `/share` route
   - Title, text, and URL are displayed
   - URL parameters are cleaned from address bar

#### Method 2: File Sharing (POST - Advanced)

1. **Install PWA** (same as above)

2. **Share files from another app**
   - **Option A (Desktop):** Right-click on image/PDF → "Share" → Select SecPal
   - **Option B (Mobile):** Gallery/Files app → Share button → Select SecPal
   - **Option C (Test with multiple files):** Select multiple files → Share → SecPal

3. **Verify file handling**
   - App opens at `/share` route
   - Files are listed with name, size, type badge
   - Image files show preview thumbnails
   - PDF/DOC files show file icon
   - File size is displayed (e.g., "1.2 MB")

4. **Test file validation**
   - Try sharing `.exe` or unsupported file → Error message shown
   - Try sharing file >10MB → Error "File too large. Maximum 10MB"
   - Only valid files (images, PDFs, .doc, .docx) are accepted

5. **Check Service Worker processing**

   ```bash
   # Chrome DevTools → Application → Service Workers
   # Status should be "activated and is running"
   # Console → Check for Service Worker messages:
   # "Processing shared files: 2 files"
   ```

6. **Check sessionStorage**

   ```bash
   # DevTools → Application → Storage → Session Storage
   # Key: share-target-files
   # Value: JSON array with file metadata + Base64 previews
   ```

7. **Test combined sharing**
   - Share files + text together
   - Example: Share image with caption
   - Both text and files should appear

8. **Test hook integration**

   ```tsx
   // In a component:
   const { sharedData, clearSharedData } = useShareTarget();

   useEffect(() => {
     if (sharedData) {
       console.log("Shared data:", sharedData);
       // Handle text: sharedData.title, sharedData.text, sharedData.url
       // Handle files: sharedData.files (array of SharedFile objects)
       clearSharedData();
     }
   }, [sharedData]);
   ```

### Share Target - Success Criteria

- ✅ SecPal appears in OS share menu (both text and file options)
- ✅ **GET method:** Text sharing works (title, text, url)
- ✅ **POST method:** File sharing works (images, PDFs, docs)
- ✅ Files are validated (type + size limits)
- ✅ Image previews are generated (Base64 thumbnails)
- ✅ Service Worker processes FormData correctly
- ✅ App opens with `/share` route
- ✅ `useShareTarget` detects shared data (text + files)
- ✅ URL is cleaned to `/` after processing
- ✅ sessionStorage stores file metadata
- ✅ Clear button removes all shared data

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
