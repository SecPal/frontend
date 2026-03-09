<!--
SPDX-FileCopyrightText: 2026 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# Offline Data Protection Roadmap

This document records the current direction for frontend offline-data protection.
Phase 1 is the implementation baseline now. Phase 2 is intentionally documented
at a decision level only so the team can continue without locking in a final
cryptographic UX prematurely.

## Phase 1

Current implementation goals:

- Do not runtime-cache authenticated API responses in the PWA layer.
- Keep offline support only in explicit application-managed stores.
- Clear sensitive client-side state on logout and on session expiry.
- Preserve static asset and app-shell caching for normal PWA behavior.

Rationale:

- Generic browser HTTP caching is too broad for sensitive tenant and user data.
- Explicit IndexedDB stores are easier to reason about, test, and clear.
- Logout must behave as a hard boundary on shared or reused devices.

## Phase 2

Phase 2 is deferred and should be treated as a follow-up design task.

Target outcome:

- Sensitive offline data is encrypted at rest in the browser.
- The data encryption key is not stored in plaintext.
- Unlocking the offline vault may require explicit user presence.

### Candidate Direction

Recommended baseline:

1. Generate a random data encryption key for offline data.
2. Encrypt sensitive IndexedDB content with WebCrypto AES-GCM.
3. Protect the data encryption key with a non-exportable or device-bound key.
4. Optionally require a short local unlock factor for convenience or shoulder-surfing resistance.

### Device-Bound Key Options

Promising options to evaluate later:

- Non-exportable WebCrypto keys
- WebAuthn-backed unlock or user-presence confirmation
- Platform keystore integration where available

### Important Constraint

Device-bound storage improves protection against copied browser data being
decrypted elsewhere. It does not fully protect against an attacker who already
controls the unlocked device and active browser profile.

Phase 2 should therefore also decide on:

- vault auto-lock after inactivity
- re-unlock requirements after reload or restart
- logout cleanup guarantees
- whether a local PIN or passphrase is only a UX layer or a real security layer

## Deferred Decisions

The following should remain open until a dedicated Phase 2 task:

- whether to require a local PIN, passphrase, or neither
- whether WebAuthn is mandatory or optional for vault unlock
- which data classes are eligible for encrypted offline retention
- whether unlock state survives tab reloads or browser restarts

## Acceptance Criteria For A Future Phase 2

- No sensitive offline records remain in plaintext at rest.
- Key material is not exportable in normal operation.
- Shared-device and copied-profile risks are reduced materially compared to Phase 1.
- The UX trade-off is documented explicitly before implementation.
