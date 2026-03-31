<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# PWA / Offline / Client-Persistenz – Security & Privacy Audit

**Datum:** 2026-03-31
**Scope:** `frontend/` Repository – alle clientseitigen Persistenzmechanismen
**Methode:** Statische Code-Analyse aller Storage-, Cache- und SW-Pfade

---

## 0. Überlappung mit offenen Issues

Folgende offene Issues decken Teile des Audit-Scopes ab:

| Issue | Titel                                                                  | Überlappende Findings                                        |
| ----- | ---------------------------------------------------------------------- | ------------------------------------------------------------ |
| #493  | Security: harden frontend offline data caching and logout cleanup      | FINDING-02, -05, -06, -08 (Phase-1-Scope: Cleanup allgemein) |
| #495  | Security: design encrypted offline vault with device-bound key options | FINDING-08 (Phase-2-Scope: PII at rest langfristig)          |
| #68   | Phase 4: Offline Data Management & Conflict Resolution                 | FINDING-03, -07 (Sync-Queue, TTL, Multi-Tab)                 |

Siehe auch `docs/OFFLINE_DATA_PROTECTION_ROADMAP.md` für die Phasen-Architektur.

**Neue Befunde (nicht durch bestehende Issues abgedeckt):**

- FINDING-01: `login_rate_limit` überlebt Logout
- FINDING-04: `static-assets`-Cache im SW ohne Expiration
- FINDING-06: `pwaRuntimeCaching.ts` Expiration-Config ist bei `injectManifest` effektlos (spezifischer als #493)
- FINDING-09: `XSRF-TOKEN`-Cookie verbleibt nach Logout (Backend-seitig)
- FINDING-10: Push-Subscription potenziell nach Logout aktiv

**Bestätigung bestehender Issues mit zusätzlichem Detail:**

- FINDING-02 liefert den konkreten Code-Befund zu #493 (Analytics userId ohne TTL/Sync)
- FINDING-08 liefert den konkreten Code-Befund zu #493/#495 (PII-Felder in localStorage)

---

## 1. Bestandsaufnahme: Lokale Persistenzmechanismen

### 1.1 localStorage

| Key                               | Inhalt                                                                                                                                                          | Sensitiv?                  | Cleanup bei Logout?                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------ |
| `auth_user`                       | User-Objekt (id, name, email, roles, permissions, hasOrganizationalScopes, hasCustomerAccess, hasSiteAccess) — **kein** employee-Feld bei persistiertem Zustand | Mittel (PII: Name, E-Mail) | **Ja** – `clearSensitiveClientState()`                 |
| `auth_token`                      | Legacy-Feld, wird beim Konstruktor von `LocalStorageAuthStorage` aktiv entfernt                                                                                 | Hoch (wenn vorhanden)      | **Ja** – sowohl Cleanup als auch Legacy-Wipe           |
| `auth_logout_barrier`             | Flag ("1") zur BFCache-Schutz                                                                                                                                   | Nein                       | Nein (absichtlich – wird beim nächsten Login gelöscht) |
| `secpal-notification-preferences` | JSON mit Notification-Kategorien (alerts, updates, maintenance)                                                                                                 | Niedrig                    | **Ja**                                                 |
| `secpal-locale`                   | Sprachpräferenz (z.B. "de")                                                                                                                                     | Nein                       | **Nein** (absichtlich – benutzerneutral)               |
| `login_rate_limit`                | Failsafe-Counter (attempts, lockoutEndTime, lastAttemptTime)                                                                                                    | Niedrig                    | **Nein**                                               |

### 1.2 sessionStorage

| Key                                | Inhalt                                                        | Cleanup bei Logout?                             |
| ---------------------------------- | ------------------------------------------------------------- | ----------------------------------------------- |
| `secpal-native-pwa-cleanup-reload` | Capacitor-Reload-Guard ("1")                                  | **Ja** – vollständiger `sessionStorage.clear()` |
| (sonstige)                         | Keine weiteren expliziten Nutzungen im Produktivcode gefunden | **Ja** – vollständiger Clear                    |

### 1.3 IndexedDB (`SecPalDB`, Version 10)

| Store                     | Inhalt                                                                                                        | Sensitiv?                    | Cleanup bei Logout?                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------- |
| `analytics`               | Offline-Tracking-Events: type, category, action, label, value, metadata, sessionId, userId, timestamp, synced | Mittel (userId referenziert) | **Ja** – `db.delete()` oder Fallback `db.analytics.clear()` |
| `organizationalUnitCache` | Organisationseinheiten: id, type, name, parent, Timestamps                                                    | Mittel (Firmenstruktur)      | **Ja** – `db.delete()` oder Fallback-Clear                  |

### 1.4 Cache API

| Cache-Name              | Inhalt                                            | Sensitiv?       | Cleanup bei Logout?                                                                           |
| ----------------------- | ------------------------------------------------- | --------------- | --------------------------------------------------------------------------------------------- |
| `auth-session-state`    | Minimaler Boolean: `{ isAuthenticated: boolean }` | Nein            | **Teilweise** – wird auf `isAuthenticated: false` gesetzt, aber Cache wird **nicht gelöscht** |
| `api-cache`             | API-Responses (laut Cleanup-Liste)                | Potenziell hoch | **Ja**                                                                                        |
| `api-users`             | User-API-Responses                                | Hoch (PII)      | **Ja**                                                                                        |
| `api-general`           | Allgemeine API-Responses                          | Mittel          | **Ja**                                                                                        |
| `static-assets`         | JS, CSS, Bilder, Fonts (CacheFirst)               | Nein            | **Nein** (korrekt – keine Benutzerdaten)                                                      |
| `images`                | Bilder (CacheFirst, 100 Einträge, 30 Tage)        | Nein            | **Nein**                                                                                      |
| `fonts`                 | Fonts (CacheFirst, 30 Einträge, 365 Tage)         | Nein            | **Nein**                                                                                      |
| `google-fonts-cache`    | Google Fonts (CacheFirst, 10 Einträge, 365 Tage)  | Nein            | **Nein**                                                                                      |
| `workbox-precache-v2-*` | Precached Build-Assets (vom Vite PWA Plugin)      | Nein            | **Nein**                                                                                      |

### 1.5 Cookies (zur Vollständigkeit)

| Cookie                           | Verwaltung                             | Cleanup bei Logout?                                              |
| -------------------------------- | -------------------------------------- | ---------------------------------------------------------------- |
| Session-Cookie (Laravel Sanctum) | httpOnly, vom Server gesetzt           | Zustand wird serverseitig invalidiert via `POST /v1/auth/logout` |
| `XSRF-TOKEN`                     | Vom Server gesetzt, vom Client gelesen | Verbleibt bis Ablauf – kein eigener clientseitiger Cleanup       |

### 1.6 Service Worker State

- **Registrierung:** `injectManifest`-Strategie via `vite-plugin-pwa`
- **Precaching:** `self.__WB_MANIFEST` (Build-Assets, injected)
- **Navigation Fallback:** Alle nicht-API-Routen → `/index.html` mit Session-Gate
- **Auth-State im SW:** Liest `auth-session-state` Cache für Offline-Routing
- **Message-Listener:** `AUTH_SESSION_CHANGED`, `SKIP_WAITING`
- **Push-Handler:** Empfängt Push-Nachrichten, validiert origin, zeigt Notifications

---

## 2. Findings

### FINDING-01: `login_rate_limit` wird bei Logout nicht gelöscht

- **Schweregrad:** Niedrig
- **Typ:** Plausibles Risiko / Best Practice
- **Betroffen:** [src/hooks/useLoginRateLimiter.ts](src/hooks/useLoginRateLimiter.ts), [src/lib/clientStateCleanup.ts](src/lib/clientStateCleanup.ts)
- **Beschreibung:** Der `login_rate_limit`-Key wird bei Logout nicht in `USER_SCOPED_LOCAL_STORAGE_KEYS` geführt und daher nicht gelöscht. Der Key enthält `attempts`, `lockoutEndTime`, `lastAttemptTime`. Obwohl nicht direkt sensitiv, bleibt er über Benutzersessions hinweg erhalten. In einem Shared-Device-Szenario sieht der nächste Benutzer den Lockout-Zustand des vorherigen Benutzers.
- **Fix:** `login_rate_limit` in `USER_SCOPED_LOCAL_STORAGE_KEYS` aufnehmen oder in `clearSensitiveClientState()` separat löschen. Alternativ: Der 15-Minuten-Reset-Timer genügt als Mitigation – dann aber dokumentieren, dass dieser Key absichtlich persistent bleibt.

### FINDING-02: Analytics-Events enthalten `userId` und werden ohne Backend-Sync angesammelt

- **Schweregrad:** Mittel
- **Typ:** Bestätigter Befund / Privacy (Data Minimization)
- **Betroffen:** [src/lib/analytics.ts](src/lib/analytics.ts), [src/lib/db.ts](src/lib/db.ts)
- **Beschreibung:** Analytik-Events in IndexedDB enthalten `userId` (Klartext-User-ID) und `sessionId`. Der Backend-Sync ist **nicht implementiert** (`TODO: Implement actual sync to backend endpoint` in [src/lib/analytics.ts](src/lib/analytics.ts#L371)). Events werden nur lokal als "synced" markiert, aber **nie tatsächlich gesendet und nie gelöscht**. Events akkumulieren unbegrenzt (kein `maxEntries`-Limit, kein TTL). Bei Logout werden sie über `resetForLogout()` und `db.delete()` gelöscht – aber nur wenn der Logout ordnungsgemäß abläuft.
- **Risiko:** Bei unerwartetem Session-Ende (Browser-Crash, Tab-Kill, Cookie-Ablauf ohne aktives Logout) können userId-verknüpfte Analytics-Events dauerhaft in IndexedDB verbleiben.
- **Fix:**
  1. TTL/maxAge für Analytics-Events einführen (z.B. Events älter als 7 Tage automatisch löschen)
  2. Maximale Event-Anzahl begrenzen (z.B. 1000 Events, dann älteste verwerfen)
  3. userId nur als gehashten Wert speichern, wenn der Backend-Sync nicht zeitnah implementiert wird
  4. Backend-Sync implementieren und nach erfolgreichem Sync Events löschen

### FINDING-03: OrganizationalUnit-Cache enthält Firmenstrukturdaten ohne TTL

- **Schweregrad:** Niedrig bis Mittel
- **Typ:** Bestätigter Befund / Data Minimization
- **Betroffen:** [src/lib/db.ts](src/lib/db.ts), [src/hooks/useOrganizationalUnitsWithOffline.ts](src/hooks/useOrganizationalUnitsWithOffline.ts)
- **Beschreibung:** Organisationseinheiten (Name, Typ, Hierarchie) werden in IndexedDB gecacht und enthalten `cachedAt` und `lastSynced` Timestamps, aber es gibt **keinen automatischen TTL-/Eviction-Mechanismus**. Beim Online-Refresh wird `clearOrganizationalUnitCache()` vor dem Neuladen aufgerufen – aber wenn der User nur offline arbeitet, bleiben alte Daten unbegrenzt erhalten. Bei Logout wird korrekt gelöscht.
- **Risiko:** Gering im Normalfall. In einem Shared-Device-Szenario mit fehlgeschlagenem Logout könnten Organisationsstrukturdaten eines anderen Mandanten sichtbar sein.
- **Fix:** Optionalen TTL-Check beim Lesen aus dem Cache einbauen (z.B. Daten älter als 24h als stale/unusable markieren).

### FINDING-04: Precache und Static-Asset-Caches überleben Logout (korrekt, aber beobachten)

- **Schweregrad:** Info
- **Typ:** Best Practice / Beobachtung
- **Betroffen:** [src/sw.ts](src/sw.ts), [src/lib/pwaRuntimeCaching.ts](src/lib/pwaRuntimeCaching.ts)
- **Beschreibung:** Die Caches `static-assets`, `images`, `fonts`, `google-fonts-cache` und `workbox-precache-v2-*` werden bei Logout absichtlich **nicht** gelöscht. Das ist korrekt – sie enthalten keine Benutzerdaten. Die `static-assets`-Cache hat aber **keine `maxEntries` oder `maxAgeSeconds` Begrenzung** im SW selbst (die Begrenzung existiert nur in `pwaRuntimeCaching.ts` für die Vite-Config, aber der SW registriert eine eigene separate `CacheFirst`-Route ohne Expiration).
- **Fix:** Im Service Worker die `static-assets`-CacheFirst-Route mit Workbox `ExpirationPlugin` ausstatten, um unkontrolliertes Wachstum zu verhindern:

  ```typescript
  import { ExpirationPlugin } from "workbox-expiration";
  // In sw.ts CacheFirst:
  new CacheFirst({
    cacheName: "static-assets",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 200,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
    ],
  });
  ```

### FINDING-05: `auth-session-state` Cache wird bei Logout nicht gelöscht, nur überschrieben

- **Schweregrad:** Niedrig
- **Typ:** Bestätigter Befund
- **Betroffen:** [src/lib/offlineSessionState.ts](src/lib/offlineSessionState.ts), [src/lib/clientStateCleanup.ts](src/lib/clientStateCleanup.ts)
- **Beschreibung:** Bei Logout wird `writeOfflineSessionState(false)` aufgerufen, was den Wert auf `{ isAuthenticated: false }` setzt. Der Cache `auth-session-state` wird aber **nicht gelöscht** und ist auch **nicht in `SENSITIVE_CACHE_NAMES`** enthalten. Der Cache enthält nur einen Boolean und kein PII – das Risiko ist daher minimal. Allerdings signalisiert das Vorhandensein des Caches potenziell, dass die App in diesem Browser genutzt wurde.
- **Fix:** Entweder `auth-session-state` in die Cleanup-Liste aufnehmen oder bewusst dokumentieren, warum der Cache bestehen bleibt (SW benötigt ihn für Post-Logout-Routing).

### FINDING-06: Doppelte CacheFirst-Registrierung für static-assets

- **Schweregrad:** Niedrig
- **Typ:** Bestätigter Befund / Inkonsistenz
- **Betroffen:** [src/sw.ts](src/sw.ts#L106-L114), [src/lib/pwaRuntimeCaching.ts](src/lib/pwaRuntimeCaching.ts#L30-L39)
- **Beschreibung:** In `sw.ts` wird eine explizite `CacheFirst`-Route für `static-assets` registriert (Zeile 106-114, ohne Expiration). In `pwaRuntimeCaching.ts` wird ebenfalls eine `static-assets`-Cache für JS/CSS definiert (mit Expiration: 50 Einträge, 365 Tage). Die Vite-PWA-Config nutzt `buildPwaRuntimeCaching()`, aber bei `injectManifest`-Strategie werden Runtime-Caching-Regeln **nicht automatisch in den SW injected** – sie müssen manuell im SW importiert werden. Die in `pwaRuntimeCaching.ts` definierten Cache-Regeln mit Expiration werden tatsächlich **nicht im SW angewendet**.
- **Risiko:** Die Expirations-Limits in `pwaRuntimeCaching.ts` sind effektlos. Die CacheFirst-Route im SW hat keine Größen- oder Zeitbegrenzung.
- **Fix:** Entweder die Expiration-Plugins direkt in `sw.ts` importieren und anwenden, oder `pwaRuntimeCaching.ts` entfernen und die gesamte Cache-Konfiguration zentral in `sw.ts` halten.

### FINDING-07: Kein Multi-Tab Logout-Race-Condition-Schutz für IndexedDB-Löschung

- **Schweregrad:** Niedrig
- **Typ:** Plausibles Risiko
- **Betroffen:** [src/lib/clientStateCleanup.ts](src/lib/clientStateCleanup.ts), [src/contexts/AuthContext.tsx](src/contexts/AuthContext.tsx)
- **Beschreibung:** Cross-Tab-Logout wird über das `storage`-Event (localStorage-Change auf `auth_user`) erkannt. Tab B erkennt den Logout von Tab A und ruft `clearAuthenticatedState(true)` auf, was `clearSensitiveClientState()` triggert. Wenn Tab A **gleichzeitig** `db.delete()` ausführt und Tab B ebenfalls `db.delete()` versucht, kann eine Race Condition auftreten. Der Fallback (`db.analytics.clear()` + `db.organizationalUnitCache.clear()`) fängt das ab.
- **Bewertung:** Der existierende Fallback-Mechanismus ist eine angemessene Mitigation. Die Race Condition führt nicht zu Datenverlust oder State-Corruption, sondern höchstens zu einem Log-Warning.
- **Fix:** Kein unmittelbarer Fix nötig. Der Fallback funktioniert. Für robustere Lösung: `isClearingSessionRef` über BroadcastChannel teilen, damit nur ein Tab die Löschung durchführt.

### FINDING-08: `auth_user` in localStorage enthält E-Mail und Name (PII)

- **Schweregrad:** Mittel
- **Typ:** Bestätigter Befund / Privacy
- **Betroffen:** [src/services/storage.ts](src/services/storage.ts), [src/services/authState.ts](src/services/authState.ts)
- **Beschreibung:** Der persistierte `auth_user`-Datensatz enthält: `id`, `name`, `email`, `roles`, `permissions`, Zugriffsflags. Das `employee`-Feld wird korrekt via `sanitizePersistedAuthUser()` **nicht** persistiert. Die Daten werden bei ordnungsgemäßem Logout gelöscht.
- **Risiko:** In einem Shared-Device-Szenario (z.B. Kiosk, geteilter Arbeitsplatz) ohne ordnungsgemäßen Logout verbleiben Name und E-Mail im localStorage. Dies ist inhärent bei SPAs mit Offline-Unterstützung und lässt sich nicht vollständig vermeiden, ohne die Offline-Fähigkeit aufzugeben.
- **Mitigation vorhanden:**
  - Logout-Barrier verhindert BFCache-Wiederherstellung
  - Session-Expired-Event triggered Auto-Logout bei 401
  - Cross-Tab-Sync löscht bei Logout in einem Tab auch andere Tabs
- **Fix:** Erwägen, ob `name` und `email` im localStorage wirklich benötigt werden oder ob ein opaker Identifier genügt und die Anzeige-Daten nur im React-State gehalten werden (nach Revalidierung vom Server). Trade-off: Offline-Anzeige des Benutzernamens wäre dann nicht möglich.

### FINDING-09: `XSRF-TOKEN`-Cookie verbleibt nach Logout

- **Schweregrad:** Niedrig
- **Typ:** Bestätigter Befund
- **Betroffen:** [src/services/csrf.ts](src/services/csrf.ts)
- **Beschreibung:** Das `XSRF-TOKEN`-Cookie wird vom Server gesetzt und clientseitig nur gelesen. Bei Logout wird es nicht explizit gelöscht. Das Token ist nach serverseitigem Session-Invalidierung wertlos, aber verbleibt bis zum Cookie-Ablauf im Browser.
- **Fix:** Kein dringender Fix nötig – das Token hat nach Logout keinen Nutzen. Für Defense-in-Depth: Server könnte das Cookie im Logout-Response explizit löschen (`Set-Cookie: XSRF-TOKEN=; Max-Age=0`).

### FINDING-10: Push-Notification-Subscription kann nach Logout bestehen bleiben

- **Schweregrad:** Niedrig bis Mittel
- **Typ:** Plausibles Risiko
- **Betroffen:** [src/hooks/usePushSubscription.ts](src/hooks/usePushSubscription.ts)
- **Beschreibung:** Push-Subscriptions werden über die Web Push API beim Browser registriert. Bei Logout werden die `secpal-notification-preferences` aus localStorage gelöscht und der Backend wird informiert (`POST /v1/auth/logout`). Ob das Backend die Push-Subscription (VAPID endpoint) bei Logout entfernt, konnte aus dem Frontend-Code nicht verifiziert werden. Falls die Subscription serverseitig bestehen bleibt, könnten Push-Nachrichten nach Logout an das Gerät geliefert werden.
- **Fix:** Im Logout-Flow vor dem API-Call `POST /v1/auth/logout` explizit `PushManager.getSubscription()` aufrufen und `.unsubscribe()` ausführen und den Endpoint serverseitig deregistrieren. Alternativ: Prüfen, ob das Backend bei Logout alle Push-Subscriptions der Session automatisch entfernt.

---

## 3. Bewertung der Architektur

### Positiv

1. **Auth-Token nicht im Client:** Authentifizierung läuft über httpOnly-Cookies (Sanctum SPA mode). Keine Token-Speicherung in localStorage/JS-zugänglichem Storage. Legacy-Token-Cleanup ist proaktiv implementiert.

2. **Sauberer Logout-Flow:** Die Kette `authStorage.clear()` → `clearSensitiveClientState()` → `syncOfflineSessionAccess(false)` → `resetAnalyticsState()` ist vollständig und deckt localStorage, sessionStorage, IndexedDB und die sensitiven Cache-API-Caches ab.

3. **SW-basierter Post-Logout-Schutz:** Der Service Worker prüft die `auth-session-state`-Cache bei jeder Navigation und redirected zu `/login`, wenn `isAuthenticated === false`. Dies verhindert, dass gecachte geschützte Seiten offline nach Logout angezeigt werden.

4. **Cross-Tab-Synchronisation:** Logout in einem Tab propagiert über das `storage`-Event und SW-Messaging zu allen anderen Tabs und dem Service Worker.

5. **BFCache-Schutz:** Der Logout-Barrier in localStorage mit `pageshow`-Event-Handler verhindert, dass bfcache-wiederhergestellte Seiten eine authentifizierte View zeigen.

6. **Sanitization bei Persistierung:** `sanitizePersistedAuthUser()` entfernt das `employee`-Feld vor dem Speichern in localStorage. Input-Validierung bei Parse.

7. **CSP-Headers:** Strikte Content-Security-Policy mit `script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`.

8. **Capacitor-Cleanup:** Native Runtime erkennt Capacitor und deregistriert alle SWs und löscht alle Caches.

### Verbesserungswürdig

1. **Analytics ohne Backend:** Events werden gesammelt, aber nie gesendet. Der lokale "synced"-Flag täuscht einen abgeschlossenen Sync vor. Events akkumulieren ohne Limit.

2. **pwaRuntimeCaching.ts ist effektlos:** Die Expiration-Konfiguration wird in der `injectManifest`-Strategie nicht automatisch angewendet. Die echte Cache-Konfiguration im SW hat keine Begrenzungen.

3. **Keine Storage-Quota-Überwachung:** `useCache.getCacheSize()` existiert, wird aber nicht proaktiv zum Schutz vor Quota-Überschreitung eingesetzt.

---

## 4. Zusammenfassende Risikomatrix

| #   | Finding                                        | Schwere        | Typ                 | Sofortaktion?        |
| --- | ---------------------------------------------- | -------------- | ------------------- | -------------------- |
| 01  | `login_rate_limit` überlebt Logout             | Niedrig        | Best Practice       | Optional             |
| 02  | Analytics mit userId, kein Sync, kein TTL      | Mittel         | Privacy / Data Min. | **Ja** – TTL + Limit |
| 03  | OrgUnit-Cache ohne TTL                         | Niedrig-Mittel | Data Minimization   | Optional             |
| 04  | static-assets Cache ohne Limit im SW           | Info           | Best Practice       | Niedrig              |
| 05  | `auth-session-state` bei Logout nicht gelöscht | Niedrig        | Vollständigkeit     | Dokumentieren        |
| 06  | Doppelte/effektlose Cache-Config               | Niedrig        | Inkonsistenz        | **Ja** – bereinigen  |
| 07  | Multi-Tab Logout Race (IndexedDB)              | Niedrig        | Edge Case           | Nein (Fallback ok)   |
| 08  | PII (Name, E-Mail) in localStorage             | Mittel         | Privacy             | Abwägen              |
| 09  | XSRF-TOKEN nach Logout                         | Niedrig        | Vollständigkeit     | Optional (Backend)   |
| 10  | Push-Subscription nach Logout                  | Niedrig-Mittel | Privacy             | **Prüfen** (Backend) |

---

## 5. Empfehlungen (Priorität)

### Hoch (neue Findings – Issue-Erstellung empfohlen)

1. **Analytics TTL + Limit implementieren** (FINDING-02): Maximale Event-Anzahl (z.B. 1000) und maximales Alter (z.B. 7 Tage). Alte Events automatisch bei jedem Track löschen. → Ergänzung zu #493.

2. **pwaRuntimeCaching.ts bereinigen** (FINDING-06): Entweder Workbox-Expiration-Plugins direkt in `sw.ts` importieren oder die Datei entfernen und klarstellen, dass die Cache-Konfiguration im SW-File lebt. → Eigenes Issue empfohlen.

### Mittel

1. **Push-Subscription bei Logout prüfen** (FINDING-10): Sicherstellen, dass das Backend Push-Subscriptions bei Logout/Session-Invalidierung entfernt. → Eigenes Issue empfohlen (cross-repo: Frontend + API).

2. **`login_rate_limit` bei Logout löschen** (FINDING-01): In `USER_SCOPED_LOCAL_STORAGE_KEYS` aufnehmen. → Eigenes Issue empfohlen.

### Niedrig

1. **static-assets im SW mit ExpirationPlugin versehen** (FINDING-04): Verhindert unkontrolliertes Cache-Wachstum. → Ergänzung zu bestehender Cache-Bereinigung unter #493.

2. **OrgUnit-Cache TTL** (FINDING-03): Optional – beim Lesen Daten > 24h als ungültig markieren. → Passt in #68 (Phase 4).

3. **XSRF-TOKEN serverseitig bei Logout löschen** (FINDING-09): Serverseitiger Fix in der API. → Eigenes Issue im API-Repo empfohlen.
