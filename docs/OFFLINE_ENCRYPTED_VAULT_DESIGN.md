<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# Encrypted Offline Vault Design

**Status:** Accepted design target for frontend issue #495
**Related issues:** #493, #495, #68

## Why this exists

The current frontend keeps a minimal authenticated user snapshot in `localStorage` and encrypts it with key material derived from the browser session's `XSRF-TOKEN` cookie. That is an improvement over cleartext persistence, but it is not a durable offline-vault design:

- the key material is tied to the browser session instead of a deliberate local unlock model
- `auth_user` still contains name and e-mail at rest
- IndexedDB stores such as analytics and the organizational-unit cache remain plaintext
- logout and service-worker gating are defined, but lock and unlock semantics are not

Issue #495 closes that design gap before implementation work starts.

## Goals

- protect long-term PII at rest for shared-device and crash-recovery scenarios
- keep browser authentication on Sanctum session cookies with no JS-readable bearer token
- support an explicit locked state that preserves encrypted offline data without keeping decrypted material in memory
- define one baseline design that works in the browser PWA, with optional device-bound hardening where platforms can prove it

## Non-goals

- offline revalidation of the server session or offline issuance of new API authority
- storing raw passkeys, bearer tokens, or decrypted vault keys in `localStorage`
- making Android-native secure hardware a mandatory prerequisite for the browser PWA path

## Target Key Hierarchy

The target vault is per user and per device/browser profile.

```text
Online login / trusted bootstrap
    -> provisions random Vault Root Key (VRK, 256-bit AES-GCM)
    -> stores only wrapped VRK material at rest

Wrapped VRK at rest
    -> baseline wrapper: Local Unlock Key (LUK) derived from PIN/passphrase
    -> optional wrapper: device-bound key when the platform can prove non-exportable local unwrap

Unlocked VRK in memory
    -> HKDF-derived store keys per data class
        -> profile key
        -> analytics key
        -> organizational-unit cache key
        -> future offline cache keys

Store keys
    -> AES-GCM record encryption with random IVs and versioned associated data
```

### Key decisions

- The **Vault Root Key (VRK)** is random and generated client-side with WebCrypto. It is never derived directly from the current `XSRF-TOKEN`, password, or passkey assertion.
- The **Local Unlock Key (LUK)** is the required cross-platform fallback. It wraps the VRK and is derived from a user-chosen local unlock secret.
- **HKDF-derived store keys** keep `auth_user`, analytics, and organizational-unit cache records cryptographically separated even though they share one unlocked vault session.
- The current `auth_user` envelope is a migration stepping stone only. After vault rollout, PII leaves `localStorage` and lives in the encrypted vault store instead.

## Device-Bound Key Options

The frontend needs an explicit comparison because "device-bound" means different things on web and native surfaces.

| Option                                                  | Offline-capable          | Cross-browser viability                           | Security assessment                                                                                                                                                                           | Design decision                                                                                                 |
| ------------------------------------------------------- | ------------------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Session / `XSRF-TOKEN`-derived key only                 | No                       | High                                              | Tied to cookie lifetime, not a durable vault root, and does not define local unlock semantics                                                                                                 | Reject as the vault root; keep only as current pre-vault transport-era mechanism                                |
| Browser-stored non-extractable `CryptoKey` in IndexedDB | Partial                  | Medium                                            | Better than raw bytes, but still browser-profile scoped rather than strongly hardware-bound and not uniform across engines                                                                    | Not sufficient as the sole protection layer; may be used as an implementation detail, not as the security claim |
| WebAuthn / passkey-assisted local unwrap                | Partial today            | Low to medium                                     | Strong long-term device-bound story when local presence and non-exportable PRF-style unwrap are broadly available, but support and offline ergonomics are not uniform enough for the baseline | Keep as an optional future enhancement, not the baseline requirement                                            |
| Native secure-hardware wrapper via Android bridge       | Yes on supported devices | Low for the browser PWA, high for Android wrapper | Strongest device binding on managed Android devices, but platform-specific and must not become the only unlock path for the web app                                                           | Track as a separate enhancement for Android-capable runtimes                                                    |
| Local unlock PIN / passphrase-derived wrapper           | Yes                      | High                                              | Not device-bound by itself, but the only cross-platform baseline that works offline and gives the user an explicit lock/unlock model                                                          | Required baseline wrapper for the first vault implementation                                                    |

### Target decision

The frontend baseline is a **hybrid vault**:

- always require a random VRK that encrypts offline PII
- always wrap that VRK with a local unlock secret so offline unlock is possible without the network
- optionally add a second device-bound wrapper when the platform can prove local, non-exportable unwrap without weakening the web baseline

This keeps the browser PWA viable while preserving a path to stronger device binding on Android and future WebAuthn-capable runtimes.

## Encryption Scope

The first vault implementation should move long-term PII out of ad-hoc storage locations and into one IndexedDB-backed encrypted vault.

### Data that moves into the vault

- the persisted authenticated user profile currently stored as `auth_user`
- analytics events that currently retain `userId`
- organizational-unit cache entries that expose company structure and names

### Data that stays outside the vault

- `auth_logout_barrier` and other minimal logout/lock coordination flags
- locale and other user-neutral preferences
- the service worker's `auth-session-state` boolean cache, because it exists only to gate offline routing and must not carry profile data

### Record format

- AES-GCM-256 via WebCrypto for vault records
- random 96-bit IV per record write
- versioned associated data including vault version, store name, and user identifier context
- explicit record versioning so unsupported envelopes are deleted rather than best-effort upgraded silently

## Lock, Unlock, and Logout Semantics

| Action               | At-rest vault data                                                                   | In-memory keys                                         | UI expectation                                               | Network/session expectation                                                                         |
| -------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Lock                 | Keep wrapped VRK and encrypted records                                               | Clear decrypted VRK and derived store keys immediately | Show a generic locked screen with no name or e-mail leakage  | Keep the existing browser session cookie untouched; lock is local-only                              |
| Unlock while online  | Keep wrapped VRK and encrypted records                                               | Rehydrate VRK only after successful local unlock       | Restore offline data and resume the app                      | May revalidate `/v1/me`, but local unlock itself is not a new login                                 |
| Unlock while offline | Keep wrapped VRK and encrypted records                                               | Rehydrate VRK only after successful local unlock       | Restore only previously cached offline-safe data             | No new server authority is granted; network writes remain unavailable                               |
| Logout while online  | Delete wrapped VRK, encrypted records, sensitive caches, and push subscription state | Clear all in-memory secrets                            | Return to logged-out UI                                      | Attempt server logout and then broadcast destructive local cleanup                                  |
| Logout while offline | Delete wrapped VRK, encrypted records, and sensitive caches immediately              | Clear all in-memory secrets                            | Return to logged-out UI without preserving a lock-only state | Local wipe still happens immediately; server-session invalidation resumes when connectivity returns |

### Behavioral rules

- **Lock is reversible locally.** It preserves encrypted offline data but removes all decrypted material from memory.
- **Logout is destructive.** It must never fall back to a lock-only behavior on shared devices.
- **Cross-tab behavior is authoritative.** Lock and logout state must propagate across tabs using the same cross-tab mechanisms already used for logout drift.
- **A locked UI must not show profile PII.** If the user wants name/e-mail while offline, they must unlock first.

## Security Boundaries and UX Trade-Offs

### Security boundaries

- Offline unlock restores access only to data that already exists locally. It does not mint new API authority and does not replace server authentication.
- The frontend must not claim hardware-backed protection on browsers that only provide origin-scoped storage semantics.
- The Android native auth bridge may help with device-bound wrapping in the future, but it must not receive or return plaintext vault contents as part of routine web rendering.
- If unwrap fails because the wrapper metadata is corrupt, the key factor changed, or the browser lost the required capability, the recovery path is a **vault reset plus fresh online bootstrap**, not a partial best-effort restore.

### UX trade-offs

- A **PIN** is convenient but weaker against offline guessing if it is the only factor. If SecPal ships a short PIN, it should be paired with retry throttling and, where available, a device-bound wrapper.
- A **passphrase** improves entropy and portability but adds friction on frequent unlocks.
- **Passkey/WebAuthn presence** gives the best user experience where supported, but current browser support is not stable enough to be the only path for the web baseline.
- Removing PII from `localStorage` means the locked shell can no longer greet the user by name without an unlock step. That is an intentional privacy trade-off.

## Migration Direction

The vault rollout should be one-way and explicit.

1. During a trusted online session, decrypt the current `auth_user` envelope if present.
2. Provision the new VRK and wrapped vault metadata.
3. Move the persisted profile into the encrypted vault store.
4. Migrate qualifying IndexedDB records into encrypted stores.
5. Remove legacy PII-bearing `localStorage` data and refuse to restore it afterward.

Unsupported or partially migrated records should be deleted instead of silently accepted.

## Follow-Up Implementation Slices

This design deliberately splits implementation into separate follow-up issues because the runtime, UX, and optional device-bound hardening do not belong in one PR.

- [#1005](https://github.com/SecPal/frontend/issues/1005): implement the baseline encrypted vault store and migrate persisted profile plus IndexedDB PII into it
- [#1007](https://github.com/SecPal/frontend/issues/1007): implement lock/unlock UX, cross-tab vault state, and destructive logout semantics for the new vault
- [#1006](https://github.com/SecPal/frontend/issues/1006): add optional device-bound wrappers for Android/native-capable runtimes without weakening the browser baseline

Those implementation issues should reuse this document as the source of truth rather than reopening the design decisions in code-review threads.
