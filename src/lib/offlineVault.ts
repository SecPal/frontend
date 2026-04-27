// SPDX-FileCopyrightText: 2026 SecPal
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { PersistedAuthUser } from "../services/authState";
import { sanitizePersistedAuthUser } from "../services/authState";
import { getCsrfTokenFromCookie } from "../services/csrf";
import {
  db,
  type AnalyticsEvent,
  type EncryptedProfileRecord,
  type EncryptedVaultRecord,
  type OrganizationalUnitCacheEntry,
  type VaultAnalyticsRecord,
  type VaultOrganizationalUnitCacheRecord,
} from "./db";
import { isCapacitorNativeRuntime } from "./nativeRuntime";

const AUTH_VAULT_LEGACY_SCHEME = "pbkdf2-aes-cbc-hmac-sha256-vault";
const AUTH_VAULT_SCHEME = "secpal-auth-vault";
const AUTH_VAULT_LEGACY_VERSION = 1;
const AUTH_VAULT_VERSION = 2;
const AUTH_VAULT_PBKDF2_ITERATIONS = 600_000;
const AUTH_VAULT_SALT_BYTES = 16;
const AUTH_VAULT_IV_BYTES = 16;
const AUTH_VAULT_HALF_KEY_BYTES = 32;
const AUTH_VAULT_DERIVED_KEY_BYTES = AUTH_VAULT_HALF_KEY_BYTES * 2;
const VAULT_RECORD_IV_BYTES = 12;
const VAULT_RECORD_TAG_BYTES = 16;
const PROFILE_RECORD_ID = "profile";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export const AUTH_VAULT_STORAGE_KEY = "auth_vault_state";
export const AUTH_VAULT_LOCK_KEY = "auth_vault_lock";

interface BrowserSessionVaultWrapper {
  kind: "browser-session";
  salt: string;
  iv: string;
  ciphertext: string;
  mac: string;
}

interface NativeDeviceBoundVaultWrapper {
  kind: "native-device-bound";
  wrappedRootKey: string;
  metadata?: string;
}

type NativeDeviceBoundVaultBridge = {
  isVaultDeviceBoundWrapperAvailable?: () => boolean | Promise<boolean>;
  wrapVaultRootKey?: (options: {
    rootKeyBase64: string;
    subjectHash: string;
  }) =>
    | { wrappedRootKey: string; metadata?: string }
    | Promise<{ wrappedRootKey: string; metadata?: string }>;
  unwrapVaultRootKey?: (options: {
    wrappedRootKey: string;
    subjectHash: string;
    metadata?: string;
  }) => { rootKeyBase64: string } | Promise<{ rootKeyBase64: string }>;
};

interface AuthVaultStateEnvelopeV1 {
  scheme: typeof AUTH_VAULT_LEGACY_SCHEME;
  version: typeof AUTH_VAULT_LEGACY_VERSION;
  salt: string;
  iv: string;
  ciphertext: string;
  mac: string;
  subjectHash: string;
}

interface AuthVaultStateEnvelopeV2 {
  scheme: typeof AUTH_VAULT_SCHEME;
  version: typeof AUTH_VAULT_VERSION;
  subjectHash: string;
  wrapper: BrowserSessionVaultWrapper | NativeDeviceBoundVaultWrapper;
}

type AuthVaultStateEnvelope =
  | AuthVaultStateEnvelopeV1
  | AuthVaultStateEnvelopeV2;

interface VaultSession {
  rootKeyBytes: Uint8Array;
  subjectHash: string;
  wrapperCacheKey: string;
}

type VaultAnalyticsPayload = Omit<
  AnalyticsEvent,
  "id" | "synced" | "timestamp"
>;

let activeVaultSession: VaultSession | null = null;

function isBrowserSessionVaultWrapper(
  value: unknown
): value is BrowserSessionVaultWrapper {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.kind === "browser-session" &&
    typeof candidate.salt === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.ciphertext === "string" &&
    typeof candidate.mac === "string"
  );
}

function isNativeDeviceBoundVaultWrapper(
  value: unknown
): value is NativeDeviceBoundVaultWrapper {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.kind === "native-device-bound" &&
    typeof candidate.wrappedRootKey === "string" &&
    (candidate.metadata === undefined || typeof candidate.metadata === "string")
  );
}

function isAuthVaultStateEnvelopeV1(
  value: unknown
): value is AuthVaultStateEnvelopeV1 {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.scheme === AUTH_VAULT_LEGACY_SCHEME &&
    candidate.version === AUTH_VAULT_LEGACY_VERSION &&
    typeof candidate.salt === "string" &&
    typeof candidate.iv === "string" &&
    typeof candidate.ciphertext === "string" &&
    typeof candidate.mac === "string" &&
    typeof candidate.subjectHash === "string"
  );
}

function isAuthVaultStateEnvelopeV2(
  value: unknown
): value is AuthVaultStateEnvelopeV2 {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return (
    candidate.scheme === AUTH_VAULT_SCHEME &&
    candidate.version === AUTH_VAULT_VERSION &&
    typeof candidate.subjectHash === "string" &&
    (isBrowserSessionVaultWrapper(candidate.wrapper) ||
      isNativeDeviceBoundVaultWrapper(candidate.wrapper))
  );
}

function isAuthVaultStateEnvelope(
  value: unknown
): value is AuthVaultStateEnvelope {
  return isAuthVaultStateEnvelopeV1(value) || isAuthVaultStateEnvelopeV2(value);
}

function getAuthVaultKeyMaterial(): string | null {
  const csrfToken = getCsrfTokenFromCookie();

  if (!csrfToken) {
    return null;
  }

  return `secpal-auth-vault:${csrfToken}`;
}

async function getNativeDeviceBoundVaultBridge(): Promise<NativeDeviceBoundVaultBridge | null> {
  if (!isCapacitorNativeRuntime()) {
    return null;
  }

  const bridge = (
    globalThis as typeof globalThis & {
      SecPalNativeAuthBridge?: unknown;
    }
  ).SecPalNativeAuthBridge;

  if (!bridge || typeof bridge !== "object") {
    return null;
  }

  const candidate = bridge as NativeDeviceBoundVaultBridge;

  if (
    typeof candidate.isVaultDeviceBoundWrapperAvailable !== "function" ||
    typeof candidate.wrapVaultRootKey !== "function" ||
    typeof candidate.unwrapVaultRootKey !== "function"
  ) {
    return null;
  }

  try {
    return (await candidate.isVaultDeviceBoundWrapperAvailable()) === true
      ? candidate
      : null;
  } catch (error) {
    console.warn(
      "[Offline Vault] Failed to detect native device-bound wrapper availability:",
      error
    );
    return null;
  }
}

function encodeBase64(bytes: Uint8Array): string {
  let binary = "";

  for (let index = 0; index < bytes.length; index += 0x8000) {
    const chunk = bytes.subarray(index, index + 0x8000);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
}

function decodeBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function createRandomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

function getStoredVaultWrapperCacheKey(
  state: AuthVaultStateEnvelope,
  currentKeyMaterial: string | null
): string | null {
  if (state.version === AUTH_VAULT_LEGACY_VERSION) {
    return currentKeyMaterial ? `browser-session:${currentKeyMaterial}` : null;
  }

  if (state.wrapper.kind === "native-device-bound") {
    return "native-device-bound";
  }

  return currentKeyMaterial ? `browser-session:${currentKeyMaterial}` : null;
}

function getStoredVaultState(): AuthVaultStateEnvelope | null {
  const storedState = localStorage.getItem(AUTH_VAULT_STORAGE_KEY);

  if (!storedState) {
    return null;
  }

  try {
    const parsedState = JSON.parse(storedState) as unknown;

    if (isAuthVaultStateEnvelope(parsedState)) {
      return parsedState;
    }

    localStorage.removeItem(AUTH_VAULT_STORAGE_KEY);
    clearOfflineVaultSession();
    return null;
  } catch {
    localStorage.removeItem(AUTH_VAULT_STORAGE_KEY);
    clearOfflineVaultSession();
    return null;
  }
}

function setStoredVaultState(state: AuthVaultStateEnvelope): void {
  localStorage.setItem(AUTH_VAULT_STORAGE_KEY, JSON.stringify(state));
}

export function hasStoredOfflineVaultState(): boolean {
  return localStorage.getItem(AUTH_VAULT_STORAGE_KEY) !== null;
}

export function isOfflineVaultLocked(): boolean {
  const locked = localStorage.getItem(AUTH_VAULT_LOCK_KEY) !== null;

  if (locked && !hasStoredOfflineVaultState()) {
    localStorage.removeItem(AUTH_VAULT_LOCK_KEY);
    return false;
  }

  return locked;
}

export function clearOfflineVaultSession(): void {
  if (activeVaultSession) {
    activeVaultSession.rootKeyBytes.fill(0);
  }

  activeVaultSession = null;
}

export function clearStoredOfflineVaultState(): void {
  localStorage.removeItem(AUTH_VAULT_STORAGE_KEY);
  localStorage.removeItem(AUTH_VAULT_LOCK_KEY);
  clearOfflineVaultSession();
}

export function lockOfflineVault(): void {
  if (!hasStoredOfflineVaultState()) {
    return;
  }

  localStorage.setItem(AUTH_VAULT_LOCK_KEY, "1");
  clearOfflineVaultSession();
}

export function clearOfflineVaultLockState(): void {
  localStorage.removeItem(AUTH_VAULT_LOCK_KEY);
}

async function ensureVaultDatabaseOpen(): Promise<void> {
  if (!db.isOpen()) {
    await db.open();
  }
}

export async function clearOfflineVaultTables(): Promise<void> {
  await ensureVaultDatabaseOpen();

  await Promise.all([
    db.vaultProfile.clear(),
    db.vaultAnalytics.clear(),
    db.vaultOrganizationalUnitCache.clear(),
  ]);
}

async function clearInvalidOfflineVaultArtifacts(): Promise<void> {
  clearStoredOfflineVaultState();
  await Promise.all([
    clearOfflineVaultTables(),
    db.analytics.clear(),
    db.organizationalUnitCache.clear(),
  ]);
}

async function deriveVaultWrapperKeys(
  keyMaterial: string,
  salt: Uint8Array
): Promise<{ encryptionKey: CryptoKey; macKey: CryptoKey }> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    textEncoder.encode(keyMaterial),
    "PBKDF2",
    false,
    ["deriveBits"]
  );

  const derivedKeyBits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      hash: "SHA-256",
      salt: toArrayBuffer(salt),
      iterations: AUTH_VAULT_PBKDF2_ITERATIONS,
    },
    baseKey,
    AUTH_VAULT_DERIVED_KEY_BYTES * 8
  );
  const derivedKey = new Uint8Array(derivedKeyBits);

  if (derivedKey.byteLength !== AUTH_VAULT_DERIVED_KEY_BYTES) {
    throw new Error("Derived auth vault key has an unexpected length.");
  }

  const encryptionKeyBytes = derivedKey.slice(0, AUTH_VAULT_HALF_KEY_BYTES);
  const macKeyBytes = derivedKey.slice(AUTH_VAULT_HALF_KEY_BYTES);

  const [encryptionKey, macKey] = await Promise.all([
    crypto.subtle.importKey(
      "raw",
      encryptionKeyBytes,
      {
        name: "AES-CBC",
        length: AUTH_VAULT_HALF_KEY_BYTES * 8,
      },
      false,
      ["encrypt", "decrypt"]
    ),
    crypto.subtle.importKey(
      "raw",
      macKeyBytes,
      {
        name: "HMAC",
        hash: "SHA-256",
      },
      false,
      ["sign", "verify"]
    ),
  ]);

  return { encryptionKey, macKey };
}

function buildLegacyAuthVaultMacPayload(
  envelope: Omit<AuthVaultStateEnvelopeV1, "mac">
): string {
  return [
    envelope.scheme,
    String(envelope.version),
    envelope.subjectHash,
    envelope.salt,
    envelope.iv,
    envelope.ciphertext,
  ].join(":");
}

function buildBrowserSessionVaultWrapperMacPayload(
  subjectHash: string,
  wrapper: Omit<BrowserSessionVaultWrapper, "kind" | "mac">
): string {
  return [
    AUTH_VAULT_SCHEME,
    String(AUTH_VAULT_VERSION),
    "browser-session",
    subjectHash,
    wrapper.salt,
    wrapper.iv,
    wrapper.ciphertext,
  ].join(":");
}

async function signMacPayload(
  payload: string,
  macKey: CryptoKey
): Promise<string> {
  const mac = await crypto.subtle.sign(
    "HMAC",
    macKey,
    textEncoder.encode(payload)
  );

  return encodeBase64(new Uint8Array(mac));
}

async function verifyMacPayload(
  payload: string,
  mac: string,
  macKey: CryptoKey
): Promise<boolean> {
  return await crypto.subtle.verify(
    "HMAC",
    macKey,
    toArrayBuffer(decodeBase64(mac)),
    textEncoder.encode(payload)
  );
}

async function encryptBrowserSessionWrappedVaultRootKeyBytes(
  rootKeyBytes: Uint8Array,
  subjectHash: string
): Promise<AuthVaultStateEnvelopeV2 | null> {
  const keyMaterial = getAuthVaultKeyMaterial();

  if (!keyMaterial) {
    return null;
  }

  const salt = createRandomBytes(AUTH_VAULT_SALT_BYTES);
  const iv = createRandomBytes(AUTH_VAULT_IV_BYTES);
  const { encryptionKey, macKey } = await deriveVaultWrapperKeys(
    keyMaterial,
    salt
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-CBC",
        iv: toArrayBuffer(iv),
      },
      encryptionKey,
      textEncoder.encode(encodeBase64(rootKeyBytes))
    )
  );

  const wrapperWithoutMac = {
    kind: "browser-session" as const,
    salt: encodeBase64(salt),
    iv: encodeBase64(iv),
    ciphertext: encodeBase64(ciphertext),
  };

  return {
    subjectHash,
    scheme: AUTH_VAULT_SCHEME,
    version: AUTH_VAULT_VERSION,
    wrapper: {
      ...wrapperWithoutMac,
      mac: await signMacPayload(
        buildBrowserSessionVaultWrapperMacPayload(
          subjectHash,
          wrapperWithoutMac
        ),
        macKey
      ),
    },
  };
}

async function decryptLegacyVaultRootKeyBytes(
  state: AuthVaultStateEnvelopeV1
): Promise<Uint8Array | null> {
  const keyMaterial = getAuthVaultKeyMaterial();

  if (!keyMaterial) {
    return null;
  }

  const envelopeWithoutMac = {
    scheme: state.scheme,
    version: state.version,
    salt: state.salt,
    iv: state.iv,
    ciphertext: state.ciphertext,
    subjectHash: state.subjectHash,
  } satisfies Omit<AuthVaultStateEnvelopeV1, "mac">;
  const { encryptionKey, macKey } = await deriveVaultWrapperKeys(
    keyMaterial,
    decodeBase64(state.salt)
  );
  const isMacValid = await verifyMacPayload(
    buildLegacyAuthVaultMacPayload(envelopeWithoutMac),
    state.mac,
    macKey
  );

  if (!isMacValid) {
    return null;
  }

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-CBC",
        iv: toArrayBuffer(decodeBase64(state.iv)),
      },
      encryptionKey,
      toArrayBuffer(decodeBase64(state.ciphertext))
    );

    const rootKeyBytes = decodeBase64(textDecoder.decode(decrypted));

    return rootKeyBytes.byteLength === 32 ? rootKeyBytes : null;
  } catch {
    return null;
  }
}

async function decryptBrowserSessionWrappedVaultRootKeyBytes(
  state: AuthVaultStateEnvelopeV2
): Promise<Uint8Array | null> {
  if (state.wrapper.kind !== "browser-session") {
    return null;
  }

  const keyMaterial = getAuthVaultKeyMaterial();

  if (!keyMaterial) {
    return null;
  }

  const wrapperWithoutMac = {
    kind: "browser-session" as const,
    salt: state.wrapper.salt,
    iv: state.wrapper.iv,
    ciphertext: state.wrapper.ciphertext,
  };
  const { encryptionKey, macKey } = await deriveVaultWrapperKeys(
    keyMaterial,
    decodeBase64(state.wrapper.salt)
  );
  const isMacValid = await verifyMacPayload(
    buildBrowserSessionVaultWrapperMacPayload(
      state.subjectHash,
      wrapperWithoutMac
    ),
    state.wrapper.mac,
    macKey
  );

  if (!isMacValid) {
    return null;
  }

  try {
    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-CBC",
        iv: toArrayBuffer(decodeBase64(state.wrapper.iv)),
      },
      encryptionKey,
      toArrayBuffer(decodeBase64(state.wrapper.ciphertext))
    );

    const rootKeyBytes = decodeBase64(textDecoder.decode(decrypted));

    return rootKeyBytes.byteLength === 32 ? rootKeyBytes : null;
  } catch {
    return null;
  }
}

async function encryptNativeDeviceBoundVaultRootKeyBytes(
  rootKeyBytes: Uint8Array,
  subjectHash: string,
  nativeBridge: NativeDeviceBoundVaultBridge
): Promise<AuthVaultStateEnvelopeV2 | null> {
  let wrappedRootKey;

  try {
    wrappedRootKey = await nativeBridge.wrapVaultRootKey?.({
      rootKeyBase64: encodeBase64(rootKeyBytes),
      subjectHash,
    });
  } catch (error) {
    console.warn(
      "[Offline Vault] Failed to wrap the vault root key with the native device-bound wrapper:",
      error
    );
    return null;
  }

  if (
    !wrappedRootKey ||
    typeof wrappedRootKey.wrappedRootKey !== "string" ||
    wrappedRootKey.wrappedRootKey.length === 0 ||
    (wrappedRootKey.metadata !== undefined &&
      typeof wrappedRootKey.metadata !== "string")
  ) {
    return null;
  }

  return {
    scheme: AUTH_VAULT_SCHEME,
    version: AUTH_VAULT_VERSION,
    subjectHash,
    wrapper: {
      kind: "native-device-bound",
      wrappedRootKey: wrappedRootKey.wrappedRootKey,
      ...(wrappedRootKey.metadata !== undefined
        ? { metadata: wrappedRootKey.metadata }
        : {}),
    },
  };
}

async function decryptNativeDeviceBoundVaultRootKeyBytes(
  state: AuthVaultStateEnvelopeV2,
  nativeBridge: NativeDeviceBoundVaultBridge
): Promise<Uint8Array | null> {
  if (state.wrapper.kind !== "native-device-bound") {
    return null;
  }

  let unwrappedRootKey;

  try {
    unwrappedRootKey = await nativeBridge.unwrapVaultRootKey?.({
      wrappedRootKey: state.wrapper.wrappedRootKey,
      subjectHash: state.subjectHash,
      ...(state.wrapper.metadata !== undefined
        ? { metadata: state.wrapper.metadata }
        : {}),
    });
  } catch (error) {
    console.warn(
      "[Offline Vault] Failed to unwrap the vault root key with the native device-bound wrapper:",
      error
    );
    return null;
  }

  const rootKeyBase64 =
    unwrappedRootKey && typeof unwrappedRootKey.rootKeyBase64 === "string"
      ? unwrappedRootKey.rootKeyBase64
      : null;

  if (!rootKeyBase64) {
    return null;
  }

  try {
    const rootKeyBytes = decodeBase64(rootKeyBase64);

    return rootKeyBytes.byteLength === 32 ? rootKeyBytes : null;
  } catch {
    return null;
  }
}

async function encryptVaultRootKeyBytes(
  rootKeyBytes: Uint8Array,
  subjectHash: string
): Promise<AuthVaultStateEnvelope | null> {
  const nativeBridge = await getNativeDeviceBoundVaultBridge();

  if (nativeBridge) {
    const nativeDeviceBoundState =
      await encryptNativeDeviceBoundVaultRootKeyBytes(
        rootKeyBytes,
        subjectHash,
        nativeBridge
      );

    if (nativeDeviceBoundState) {
      return nativeDeviceBoundState;
    }
  }

  return encryptBrowserSessionWrappedVaultRootKeyBytes(
    rootKeyBytes,
    subjectHash
  );
}

async function decryptVaultRootKeyBytes(
  state: AuthVaultStateEnvelope
): Promise<Uint8Array | null> {
  if (state.version === AUTH_VAULT_LEGACY_VERSION) {
    return decryptLegacyVaultRootKeyBytes(state);
  }

  if (state.wrapper.kind === "native-device-bound") {
    const nativeBridge = await getNativeDeviceBoundVaultBridge();

    return nativeBridge
      ? decryptNativeDeviceBoundVaultRootKeyBytes(state, nativeBridge)
      : null;
  }

  return decryptBrowserSessionWrappedVaultRootKeyBytes(state);
}

async function computeSubjectHash(userId: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(userId)
  );

  return encodeBase64(new Uint8Array(digest));
}

function createVaultRecordId(prefix: string): string {
  if (typeof crypto.randomUUID === "function") {
    return `${prefix}:${crypto.randomUUID()}`;
  }

  return `${prefix}:${encodeBase64(createRandomBytes(12))}`;
}

async function deriveVaultStoreKey(
  rootKeyBytes: Uint8Array,
  storeName: string
): Promise<CryptoKey> {
  const hkdfKey = await crypto.subtle.importKey(
    "raw",
    toArrayBuffer(rootKeyBytes),
    "HKDF",
    false,
    ["deriveKey"]
  );

  return await crypto.subtle.deriveKey(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: toArrayBuffer(new Uint8Array(0)),
      info: textEncoder.encode(`secpal-offline-vault:${storeName}`),
    },
    hkdfKey,
    {
      name: "AES-GCM",
      length: 256,
    },
    false,
    ["encrypt", "decrypt"]
  );
}

function buildVaultAdditionalData(
  storeName: string,
  recordId: string,
  subjectHash: string
): Uint8Array {
  return textEncoder.encode(
    JSON.stringify({
      version: AUTH_VAULT_VERSION,
      storeName,
      recordId,
      subjectHash,
    })
  );
}

async function encryptVaultRecord(
  payload: unknown,
  storeName: string,
  recordId: string,
  session: VaultSession
): Promise<EncryptedVaultRecord> {
  const key = await deriveVaultStoreKey(session.rootKeyBytes, storeName);
  const iv = createRandomBytes(VAULT_RECORD_IV_BYTES);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        tagLength: 128,
        additionalData: toArrayBuffer(
          buildVaultAdditionalData(storeName, recordId, session.subjectHash)
        ),
      },
      key,
      toArrayBuffer(textEncoder.encode(JSON.stringify(payload)))
    )
  );
  const ciphertext = encrypted.slice(
    0,
    encrypted.length - VAULT_RECORD_TAG_BYTES
  );
  const authTag = encrypted.slice(encrypted.length - VAULT_RECORD_TAG_BYTES);

  return {
    recordId,
    version: AUTH_VAULT_VERSION,
    ciphertext: encodeBase64(ciphertext),
    iv: encodeBase64(iv),
    authTag: encodeBase64(authTag),
  };
}

async function decryptVaultRecord<T>(
  record: EncryptedVaultRecord,
  storeName: string,
  session: VaultSession
): Promise<T | null> {
  try {
    const key = await deriveVaultStoreKey(session.rootKeyBytes, storeName);
    const ciphertext = decodeBase64(record.ciphertext);
    const authTag = decodeBase64(record.authTag);
    const combined = new Uint8Array(ciphertext.length + authTag.length);

    combined.set(ciphertext, 0);
    combined.set(authTag, ciphertext.length);

    const decrypted = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(decodeBase64(record.iv)),
        tagLength: 128,
        additionalData: toArrayBuffer(
          buildVaultAdditionalData(
            storeName,
            record.recordId,
            session.subjectHash
          )
        ),
      },
      key,
      toArrayBuffer(combined)
    );

    return JSON.parse(textDecoder.decode(decrypted)) as T;
  } catch {
    return null;
  }
}

async function ensureOfflineVaultSession(): Promise<VaultSession | null> {
  const currentKeyMaterial = getAuthVaultKeyMaterial();
  const storedState = getStoredVaultState();
  const storedWrapperCacheKey = storedState
    ? getStoredVaultWrapperCacheKey(storedState, currentKeyMaterial)
    : null;

  if (activeVaultSession) {
    if (
      storedState &&
      storedWrapperCacheKey !== null &&
      activeVaultSession.wrapperCacheKey === storedWrapperCacheKey &&
      activeVaultSession.subjectHash === storedState.subjectHash
    ) {
      return activeVaultSession;
    }

    clearOfflineVaultSession();
  }

  if (!storedState) {
    return null;
  }

  const rootKeyBytes = await decryptVaultRootKeyBytes(storedState);

  if (!rootKeyBytes) {
    await clearInvalidOfflineVaultArtifacts();
    return null;
  }

  activeVaultSession = {
    rootKeyBytes,
    subjectHash: storedState.subjectHash,
    wrapperCacheKey: storedWrapperCacheKey ?? "native-device-bound",
  };

  return activeVaultSession;
}

async function maybeRewriteStoredVaultState(
  session: VaultSession,
  storedState: AuthVaultStateEnvelope
): Promise<VaultSession> {
  const preferredWrapperKind = (await getNativeDeviceBoundVaultBridge())
    ? "native-device-bound"
    : "browser-session";
  const currentWrapperKind =
    storedState.version === AUTH_VAULT_LEGACY_VERSION
      ? "browser-session"
      : storedState.wrapper.kind;

  if (
    storedState.version === AUTH_VAULT_VERSION &&
    currentWrapperKind === preferredWrapperKind
  ) {
    return session;
  }

  const rewrittenState = await encryptVaultRootKeyBytes(
    session.rootKeyBytes,
    session.subjectHash
  );

  if (!rewrittenState) {
    return session;
  }

  setStoredVaultState(rewrittenState);

  return {
    ...session,
    wrapperCacheKey:
      getStoredVaultWrapperCacheKey(
        rewrittenState,
        getAuthVaultKeyMaterial()
      ) ?? session.wrapperCacheKey,
  };
}

async function ensureVaultSessionForUser(
  user: PersistedAuthUser
): Promise<VaultSession> {
  const subjectHash = await computeSubjectHash(user.id);
  const currentSession = await ensureOfflineVaultSession();
  const existingStoredState = getStoredVaultState();

  if (currentSession && currentSession.subjectHash === subjectHash) {
    if (existingStoredState) {
      return maybeRewriteStoredVaultState(currentSession, existingStoredState);
    }

    return currentSession;
  }

  if (currentSession && currentSession.subjectHash !== subjectHash) {
    await clearOfflineVaultTables();
    clearStoredOfflineVaultState();
  }

  const rootKeyBytes = createRandomBytes(32);
  const storedState = await encryptVaultRootKeyBytes(rootKeyBytes, subjectHash);

  if (!storedState) {
    throw new Error(
      "Failed to derive auth vault key due to missing CSRF token/session context."
    );
  }

  setStoredVaultState(storedState);
  activeVaultSession = {
    rootKeyBytes,
    subjectHash,
    wrapperCacheKey:
      getStoredVaultWrapperCacheKey(storedState, getAuthVaultKeyMaterial()) ??
      "native-device-bound",
  };

  return activeVaultSession;
}

async function persistProfileRecord(
  user: PersistedAuthUser,
  session: VaultSession
): Promise<void> {
  await ensureVaultDatabaseOpen();

  const encryptedRecord = await encryptVaultRecord(
    user,
    "profile",
    PROFILE_RECORD_ID,
    session
  );

  await db.vaultProfile.put({
    id: PROFILE_RECORD_ID,
    ...encryptedRecord,
  } satisfies EncryptedProfileRecord);
}

async function migrateLegacyAnalyticsRecords(
  session: VaultSession
): Promise<void> {
  await ensureVaultDatabaseOpen();

  const legacyRecords = await db.analytics.toArray();

  if (legacyRecords.length === 0) {
    return;
  }

  const encryptedRecords = await Promise.all(
    legacyRecords.map(async (record) => {
      const { synced, timestamp, ...payloadWithId } = record;
      const payload = { ...payloadWithId };

      delete payload.id;

      const recordId =
        typeof record.id === "number"
          ? `legacy:${record.id}`
          : createVaultRecordId("analytics");
      const encryptedPayload = await encryptVaultRecord(
        payload,
        "analytics",
        recordId,
        session
      );

      return {
        synced,
        timestamp,
        ...encryptedPayload,
      } satisfies Omit<VaultAnalyticsRecord, "id">;
    })
  );

  await db.vaultAnalytics.bulkPut(encryptedRecords);
  await db.analytics.clear();
}

async function migrateLegacyOrganizationalUnitRecords(
  session: VaultSession
): Promise<void> {
  await ensureVaultDatabaseOpen();

  const legacyRecords = await db.organizationalUnitCache.toArray();

  if (legacyRecords.length === 0) {
    return;
  }

  const encryptedRecords = await Promise.all(
    legacyRecords.map(async (record) => {
      const encryptedPayload = await encryptVaultRecord(
        record,
        "organizationalUnitCache",
        record.id,
        session
      );

      return {
        id: record.id,
        cachedAt: record.cachedAt,
        lastSynced: record.lastSynced,
        ...encryptedPayload,
      } satisfies VaultOrganizationalUnitCacheRecord;
    })
  );

  await db.vaultOrganizationalUnitCache.bulkPut(encryptedRecords);
  await db.organizationalUnitCache.clear();
}

export async function initializeOfflineVault(
  user: PersistedAuthUser
): Promise<void> {
  const session = await ensureVaultSessionForUser(user);

  await persistProfileRecord(user, session);
  await Promise.all([
    migrateLegacyAnalyticsRecords(session),
    migrateLegacyOrganizationalUnitRecords(session),
  ]);

  localStorage.removeItem("auth_user");
}

export async function readPersistedAuthUserFromVault(): Promise<PersistedAuthUser | null> {
  const session = await ensureOfflineVaultSession();

  if (!session) {
    return null;
  }

  await ensureVaultDatabaseOpen();

  const storedProfile = await db.vaultProfile.get(PROFILE_RECORD_ID);

  if (!storedProfile) {
    await clearInvalidOfflineVaultArtifacts();
    return null;
  }

  const decryptedUser = await decryptVaultRecord<unknown>(
    storedProfile,
    "profile",
    session
  );
  const sanitizedUser = sanitizePersistedAuthUser(decryptedUser);

  if (!sanitizedUser) {
    console.error(
      "Failed to parse stored user data:",
      new SyntaxError("Invalid encrypted vault profile payload.")
    );
    await clearInvalidOfflineVaultArtifacts();
    return null;
  }

  return sanitizedUser;
}

export async function storeVaultAnalyticsEvent(
  event: AnalyticsEvent
): Promise<number> {
  const session = await ensureOfflineVaultSession();

  if (!session) {
    throw new Error("Offline vault is not available.");
  }

  await ensureVaultDatabaseOpen();

  const recordId = createVaultRecordId("analytics");
  const { synced, timestamp, ...payloadWithId } = event;
  const payload = { ...payloadWithId };

  delete payload.id;

  const encryptedPayload = await encryptVaultRecord(
    payload satisfies VaultAnalyticsPayload,
    "analytics",
    recordId,
    session
  );

  const insertedId = await db.vaultAnalytics.add({
    synced,
    timestamp,
    ...encryptedPayload,
  });

  if (typeof insertedId !== "number") {
    throw new Error("Vault analytics record was created without a numeric ID.");
  }

  return insertedId;
}

export async function listVaultAnalyticsEvents(): Promise<AnalyticsEvent[]> {
  const session = await ensureOfflineVaultSession();

  if (!session) {
    return [];
  }

  await migrateLegacyAnalyticsRecords(session);

  const records = await db.vaultAnalytics.toArray();
  const invalidIds: number[] = [];
  const decryptedEvents = await Promise.all(
    records.map(async (record) => {
      const payload = await decryptVaultRecord<VaultAnalyticsPayload>(
        record,
        "analytics",
        session
      );

      if (!payload) {
        if (record.id !== undefined) {
          invalidIds.push(record.id);
        }

        return null;
      }

      const event: AnalyticsEvent = {
        synced: record.synced,
        timestamp: record.timestamp,
        ...payload,
      };

      if (record.id !== undefined) {
        event.id = record.id;
      }

      return event;
    })
  );

  if (invalidIds.length > 0) {
    await db.vaultAnalytics.bulkDelete(invalidIds);
  }

  return decryptedEvents.flatMap((event) => (event ? [event] : []));
}

export async function listUnsyncedVaultAnalyticsRecordIds(): Promise<number[]> {
  await ensureVaultDatabaseOpen();

  const records = await db.vaultAnalytics.where("synced").equals(0).toArray();

  return records.flatMap((record) =>
    record.id === undefined ? [] : [record.id]
  );
}

export async function markVaultAnalyticsEventsSynced(
  ids: number[]
): Promise<void> {
  if (ids.length === 0) {
    return;
  }

  await ensureVaultDatabaseOpen();

  await db.vaultAnalytics.bulkUpdate(
    ids.map((id) => ({
      key: id,
      changes: { synced: true },
    }))
  );
}

export async function clearVaultAnalytics(): Promise<void> {
  await ensureVaultDatabaseOpen();
  await db.vaultAnalytics.clear();
}

export async function clearOldVaultAnalyticsEvents(
  olderThanTimestamp: number
): Promise<void> {
  await ensureVaultDatabaseOpen();

  await db.vaultAnalytics
    .where("synced")
    .equals(1)
    .and((record) => record.timestamp < olderThanTimestamp)
    .delete();
}

export async function saveVaultOrganizationalUnit(
  unit: OrganizationalUnitCacheEntry
): Promise<void> {
  const session = await ensureOfflineVaultSession();

  if (!session) {
    throw new Error("Offline vault is not available.");
  }

  await ensureVaultDatabaseOpen();

  const encryptedPayload = await encryptVaultRecord(
    unit,
    "organizationalUnitCache",
    unit.id,
    session
  );

  await db.vaultOrganizationalUnitCache.put({
    id: unit.id,
    cachedAt: unit.cachedAt,
    lastSynced: unit.lastSynced,
    ...encryptedPayload,
  });
}

export async function getVaultOrganizationalUnit(
  id: string
): Promise<OrganizationalUnitCacheEntry | undefined> {
  const session = await ensureOfflineVaultSession();

  if (!session) {
    return undefined;
  }

  await ensureVaultDatabaseOpen();

  await migrateLegacyOrganizationalUnitRecords(session);

  const record = await db.vaultOrganizationalUnitCache.get(id);

  if (!record) {
    return undefined;
  }

  const decryptedRecord =
    await decryptVaultRecord<OrganizationalUnitCacheEntry>(
      record,
      "organizationalUnitCache",
      session
    );

  if (!decryptedRecord) {
    await db.vaultOrganizationalUnitCache.delete(id);
    return undefined;
  }

  return {
    ...decryptedRecord,
    cachedAt: record.cachedAt,
    lastSynced: record.lastSynced,
  };
}

export async function listVaultOrganizationalUnits(): Promise<
  OrganizationalUnitCacheEntry[]
> {
  const session = await ensureOfflineVaultSession();

  if (!session) {
    return [];
  }

  await ensureVaultDatabaseOpen();

  await migrateLegacyOrganizationalUnitRecords(session);

  const records = await db.vaultOrganizationalUnitCache.toArray();
  const invalidIds: string[] = [];
  const decryptedRecords = await Promise.all(
    records.map(async (record) => {
      const decryptedRecord =
        await decryptVaultRecord<OrganizationalUnitCacheEntry>(
          record,
          "organizationalUnitCache",
          session
        );

      if (!decryptedRecord) {
        invalidIds.push(record.id);
        return null;
      }

      return {
        ...decryptedRecord,
        cachedAt: record.cachedAt,
        lastSynced: record.lastSynced,
      };
    })
  );

  if (invalidIds.length > 0) {
    await db.vaultOrganizationalUnitCache.bulkDelete(invalidIds);
  }

  return decryptedRecords.filter(
    (record): record is OrganizationalUnitCacheEntry => record !== null
  );
}

export async function deleteVaultOrganizationalUnit(id: string): Promise<void> {
  await ensureVaultDatabaseOpen();

  await Promise.all([
    db.vaultOrganizationalUnitCache.delete(id),
    db.organizationalUnitCache.delete(id),
  ]);
}

export async function clearVaultOrganizationalUnits(): Promise<void> {
  await ensureVaultDatabaseOpen();

  await Promise.all([
    db.vaultOrganizationalUnitCache.clear(),
    db.organizationalUnitCache.clear(),
  ]);
}
