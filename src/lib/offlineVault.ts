// SPDX-FileCopyrightText: 2026 SecPal Contributors
// SPDX-License-Identifier: AGPL-3.0-or-later AND LicenseRef-SecPal-Attribution

import Dexie from "dexie";
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
import {
  AUTH_VAULT_LOCK_KEY,
  AUTH_VAULT_STORAGE_KEY,
} from "./offlineVaultKeys";
import {
  clearActiveOfflineVaultSession,
  getActiveOfflineVaultSession,
  isVaultOrgUnitIndexEnsured,
  markVaultOrgUnitIndexEnsured,
  setActiveOfflineVaultSession,
} from "./offlineVaultRuntime";
import { isCapacitorNativeRuntime } from "./nativeRuntime";
import {
  awaitAbortable as awaitVaultOperation,
  throwIfAborted,
} from "./abortablePromise";
export {
  AUTH_USER_REVALIDATION_REQUIRED_KEY,
  AUTH_VAULT_LOCK_KEY,
  AUTH_VAULT_STORAGE_KEY,
} from "./offlineVaultKeys";

const AUTH_VAULT_LEGACY_SCHEME = "pbkdf2-aes-cbc-hmac-sha256-vault";
const AUTH_VAULT_SCHEME = "secpal-auth-vault";
const AUTH_VAULT_LEGACY_VERSION = 1;
const AUTH_VAULT_VERSION = 2;
const AUTH_VAULT_RECORD_VERSION = 1;
const AUTH_VAULT_PBKDF2_ITERATIONS = 600_000;
const AUTH_VAULT_SALT_BYTES = 16;
const AUTH_VAULT_IV_BYTES = 16;
const AUTH_VAULT_HALF_KEY_BYTES = 32;
const AUTH_VAULT_DERIVED_KEY_BYTES = AUTH_VAULT_HALF_KEY_BYTES * 2;
const VAULT_RECORD_IV_BYTES = 12;
const VAULT_RECORD_TAG_BYTES = 16;
const NATIVE_VAULT_WRAPPING_KEY_ID = "native-auth-vault";
const RECENT_AUTH_VAULT_KEY_MATERIALS_MAX = 3;
const PROFILE_RECORD_ID = "profile";
const ROOT_ORGANIZATIONAL_UNIT_PARENT_LOOKUP_KEY = "__root__";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

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

interface WebCryptoDeviceBoundVaultWrapper {
  kind: "webcrypto-device-bound";
  keyId: typeof NATIVE_VAULT_WRAPPING_KEY_ID;
  iv: string;
  ciphertext: string;
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
  initialization?: "pending";
  wrapper:
    | BrowserSessionVaultWrapper
    | NativeDeviceBoundVaultWrapper
    | WebCryptoDeviceBoundVaultWrapper;
}

type AuthVaultStateEnvelope =
  AuthVaultStateEnvelopeV1 | AuthVaultStateEnvelopeV2;

interface VaultSession {
  rootKeyBytes: Uint8Array;
  subjectHash: string;
  wrapperCacheKey: string;
}

interface VaultRootKeyDecryptionResult {
  rootKeyBytes: Uint8Array | null;
  keyMaterialUsed: string | null;
}

export interface OfflineVaultOperationOptions {
  signal?: AbortSignal;
  shouldCommit?: () => boolean;
}

function throwIfVaultOperationAborted(signal?: AbortSignal): void {
  throwIfAborted(signal);
}

function throwIfVaultOperationCannotCommit(
  signal?: AbortSignal,
  shouldCommit?: () => boolean
): void {
  throwIfVaultOperationAborted(signal);

  if (shouldCommit && !shouldCommit()) {
    throw new DOMException("The vault operation was superseded.", "AbortError");
  }
}

type VaultAnalyticsPayload = Omit<
  AnalyticsEvent,
  "id" | "synced" | "timestamp"
>;

type VaultOrganizationalUnitIndexFields = Pick<
  VaultOrganizationalUnitCacheRecord,
  "type" | "parent_id" | "parentLookupKey"
>;

let recentAuthVaultKeyMaterials: string[] = [];

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
  const wrapper = candidate.wrapper;

  if (typeof wrapper !== "object" || wrapper === null) {
    return false;
  }

  const wrapperCandidate = wrapper as Record<string, unknown>;

  return (
    candidate.scheme === AUTH_VAULT_SCHEME &&
    candidate.version === AUTH_VAULT_VERSION &&
    typeof candidate.subjectHash === "string" &&
    (candidate.initialization === undefined ||
      candidate.initialization === "pending") &&
    ((wrapperCandidate.kind === "browser-session" &&
      typeof wrapperCandidate.salt === "string" &&
      typeof wrapperCandidate.iv === "string" &&
      typeof wrapperCandidate.ciphertext === "string" &&
      typeof wrapperCandidate.mac === "string") ||
      (wrapperCandidate.kind === "native-device-bound" &&
        typeof wrapperCandidate.wrappedRootKey === "string" &&
        (wrapperCandidate.metadata === undefined ||
          typeof wrapperCandidate.metadata === "string")) ||
      (wrapperCandidate.kind === "webcrypto-device-bound" &&
        wrapperCandidate.keyId === NATIVE_VAULT_WRAPPING_KEY_ID &&
        typeof wrapperCandidate.iv === "string" &&
        typeof wrapperCandidate.ciphertext === "string"))
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

  const keyMaterial = `secpal-auth-vault:${csrfToken}`;

  if (!hasStoredOfflineVaultState()) {
    recentAuthVaultKeyMaterials = [keyMaterial];
    return keyMaterial;
  }

  recentAuthVaultKeyMaterials = [
    keyMaterial,
    ...recentAuthVaultKeyMaterials.filter((entry) => entry !== keyMaterial),
  ].slice(0, RECENT_AUTH_VAULT_KEY_MATERIALS_MAX);

  return keyMaterial;
}

export function rememberCurrentAuthVaultKeyMaterial(): void {
  void getAuthVaultKeyMaterial();
}

function getAuthVaultKeyMaterialCandidates(): string[] {
  const currentKeyMaterial = getAuthVaultKeyMaterial();

  if (!currentKeyMaterial) {
    return [...recentAuthVaultKeyMaterials];
  }

  return [
    currentKeyMaterial,
    ...recentAuthVaultKeyMaterials.filter(
      (entry) => entry !== currentKeyMaterial
    ),
  ];
}

async function getNativeDeviceBoundVaultBridge(
  signal?: AbortSignal
): Promise<NativeDeviceBoundVaultBridge | null> {
  throwIfVaultOperationAborted(signal);

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
    const isAvailable = await awaitVaultOperation(
      Promise.resolve(candidate.isVaultDeviceBoundWrapperAvailable()),
      signal
    );

    return isAvailable === true ? candidate : null;
  } catch {
    throwIfVaultOperationAborted(signal);
    console.warn(
      "[Offline Vault] Native device-bound wrapper detection failed; using the available fallback."
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

  if (state.wrapper.kind === "webcrypto-device-bound") {
    return `webcrypto-device-bound:${state.wrapper.keyId}`;
  }

  return currentKeyMaterial ? `browser-session:${currentKeyMaterial}` : null;
}

function getSessionWrapperCacheKey(state: AuthVaultStateEnvelope): string {
  return (
    getStoredVaultWrapperCacheKey(state, getAuthVaultKeyMaterial()) ??
    "native-device-bound"
  );
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

function isVaultInitializationPending(
  state: AuthVaultStateEnvelope | null
): state is AuthVaultStateEnvelopeV2 & { initialization: "pending" } {
  return (
    state?.version === AUTH_VAULT_VERSION && state.initialization === "pending"
  );
}

function preserveVaultInitializationState(
  state: AuthVaultStateEnvelope,
  previousState: AuthVaultStateEnvelope
): AuthVaultStateEnvelope {
  if (
    state.version === AUTH_VAULT_VERSION &&
    isVaultInitializationPending(previousState)
  ) {
    return { ...state, initialization: "pending" };
  }

  return state;
}

function completeVaultInitialization(subjectHash: string): void {
  const state = getStoredVaultState();

  if (
    !isVaultInitializationPending(state) ||
    state.subjectHash !== subjectHash
  ) {
    return;
  }

  setStoredVaultState({ ...state, initialization: undefined });
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
  clearActiveOfflineVaultSession();
}

export function clearRecentAuthVaultKeyMaterials(): void {
  recentAuthVaultKeyMaterials = [];
}

export function clearStoredOfflineVaultState(): void {
  localStorage.removeItem(AUTH_VAULT_STORAGE_KEY);
  localStorage.removeItem(AUTH_VAULT_LOCK_KEY);
  clearOfflineVaultSession();
  clearRecentAuthVaultKeyMaterials();
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

async function ensureVaultDatabaseOpen(signal?: AbortSignal): Promise<void> {
  if (!db.isOpen()) {
    await awaitVaultOperation(db.open(), signal);
  }

  throwIfVaultOperationAborted(signal);
}

export async function clearOfflineVaultTables(
  options: OfflineVaultOperationOptions = {}
): Promise<void> {
  await ensureVaultDatabaseOpen(options.signal);
  throwIfVaultOperationAborted(options.signal);

  await db.transaction(
    "rw",
    [
      db.vaultProfile,
      db.vaultWrappingKeys,
      db.vaultAnalytics,
      db.vaultOrganizationalUnitCache,
    ],
    async () => {
      throwIfVaultOperationAborted(options.signal);
      await awaitVaultOperation(
        Promise.all([
          db.vaultProfile.clear(),
          db.vaultWrappingKeys.clear(),
          db.vaultAnalytics.clear(),
          db.vaultOrganizationalUnitCache.clear(),
        ]),
        options.signal
      );
      throwIfVaultOperationAborted(options.signal);
    }
  );
}

export async function clearInvalidOfflineVaultArtifacts(
  options: OfflineVaultOperationOptions = {}
): Promise<void> {
  await ensureVaultDatabaseOpen(options.signal);
  throwIfVaultOperationAborted(options.signal);
  await db.transaction(
    "rw",
    [
      db.vaultProfile,
      db.vaultWrappingKeys,
      db.vaultAnalytics,
      db.vaultOrganizationalUnitCache,
      db.analytics,
      db.organizationalUnitCache,
    ],
    async () => {
      throwIfVaultOperationAborted(options.signal);
      await awaitVaultOperation(
        Promise.all([
          db.vaultProfile.clear(),
          db.vaultWrappingKeys.clear(),
          db.vaultAnalytics.clear(),
          db.vaultOrganizationalUnitCache.clear(),
          db.analytics.clear(),
          db.organizationalUnitCache.clear(),
        ]),
        options.signal
      );
      throwIfVaultOperationAborted(options.signal);
    }
  );
  throwIfVaultOperationAborted(options.signal);
  clearStoredOfflineVaultState();
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

async function decryptLegacyVaultRootKeyBytesWithKeyMaterial(
  state: AuthVaultStateEnvelopeV1,
  keyMaterial: string
): Promise<Uint8Array | null> {
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

async function decryptLegacyVaultRootKeyBytes(
  state: AuthVaultStateEnvelopeV1
): Promise<VaultRootKeyDecryptionResult> {
  for (const keyMaterial of getAuthVaultKeyMaterialCandidates()) {
    const rootKeyBytes = await decryptLegacyVaultRootKeyBytesWithKeyMaterial(
      state,
      keyMaterial
    );

    if (rootKeyBytes) {
      return { rootKeyBytes, keyMaterialUsed: keyMaterial };
    }
  }

  return { rootKeyBytes: null, keyMaterialUsed: null };
}

async function decryptBrowserSessionWrappedVaultRootKeyBytesWithKeyMaterial(
  state: AuthVaultStateEnvelopeV2,
  keyMaterial: string
): Promise<Uint8Array | null> {
  if (state.wrapper.kind !== "browser-session") {
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

async function decryptBrowserSessionWrappedVaultRootKeyBytes(
  state: AuthVaultStateEnvelopeV2
): Promise<VaultRootKeyDecryptionResult> {
  for (const keyMaterial of getAuthVaultKeyMaterialCandidates()) {
    const rootKeyBytes =
      await decryptBrowserSessionWrappedVaultRootKeyBytesWithKeyMaterial(
        state,
        keyMaterial
      );

    if (rootKeyBytes) {
      return { rootKeyBytes, keyMaterialUsed: keyMaterial };
    }
  }

  return { rootKeyBytes: null, keyMaterialUsed: null };
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
  } catch {
    console.warn(
      "[Offline Vault] Native device-bound wrapping failed; using the WebCrypto fallback."
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
      metadata: wrappedRootKey.metadata,
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
      metadata: state.wrapper.metadata,
    });
  } catch {
    console.warn(
      "[Offline Vault] Native device-bound vault unwrapping failed."
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

function buildWebCryptoDeviceBoundAdditionalData(
  subjectHash: string
): Uint8Array {
  return textEncoder.encode(
    `${AUTH_VAULT_SCHEME}:webcrypto-device-bound:${subjectHash}`
  );
}

async function getOrCreateWebCryptoDeviceWrappingKey(
  signal?: AbortSignal
): Promise<CryptoKey> {
  await ensureVaultDatabaseOpen(signal);
  throwIfVaultOperationAborted(signal);

  return db.transaction("rw", db.vaultWrappingKeys, async () => {
    throwIfVaultOperationAborted(signal);
    const storedKey = await awaitVaultOperation(
      db.vaultWrappingKeys.get(NATIVE_VAULT_WRAPPING_KEY_ID),
      signal
    );
    throwIfVaultOperationAborted(signal);

    if (storedKey) {
      return storedKey.key;
    }

    const generatedKey = (await Dexie.waitFor(
      awaitVaultOperation(
        crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, [
          "encrypt",
          "decrypt",
        ]),
        signal
      )
    )) as CryptoKey;
    throwIfVaultOperationAborted(signal);
    await awaitVaultOperation(
      db.vaultWrappingKeys.add({
        id: NATIVE_VAULT_WRAPPING_KEY_ID,
        key: generatedKey,
      }),
      signal
    );
    throwIfVaultOperationAborted(signal);

    return generatedKey;
  });
}

async function encryptWebCryptoDeviceBoundVaultRootKeyBytes(
  rootKeyBytes: Uint8Array,
  subjectHash: string,
  signal?: AbortSignal
): Promise<AuthVaultStateEnvelopeV2> {
  const key = await getOrCreateWebCryptoDeviceWrappingKey(signal);
  const iv = createRandomBytes(VAULT_RECORD_IV_BYTES);
  const ciphertext = await awaitVaultOperation(
    crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: toArrayBuffer(iv),
        additionalData: toArrayBuffer(
          buildWebCryptoDeviceBoundAdditionalData(subjectHash)
        ),
      },
      key,
      toArrayBuffer(rootKeyBytes)
    ),
    signal
  );

  return {
    scheme: AUTH_VAULT_SCHEME,
    version: AUTH_VAULT_VERSION,
    subjectHash,
    wrapper: {
      kind: "webcrypto-device-bound",
      keyId: NATIVE_VAULT_WRAPPING_KEY_ID,
      iv: encodeBase64(iv),
      ciphertext: encodeBase64(new Uint8Array(ciphertext)),
    },
  };
}

async function decryptWebCryptoDeviceBoundVaultRootKeyBytes(
  state: AuthVaultStateEnvelopeV2,
  signal?: AbortSignal
): Promise<Uint8Array | null> {
  if (state.wrapper.kind !== "webcrypto-device-bound") {
    return null;
  }

  await ensureVaultDatabaseOpen(signal);
  throwIfVaultOperationAborted(signal);
  const storedKey = await awaitVaultOperation(
    db.vaultWrappingKeys.get(state.wrapper.keyId),
    signal
  );

  if (!storedKey) {
    return null;
  }

  try {
    const rootKeyBytes = new Uint8Array(
      await awaitVaultOperation(
        crypto.subtle.decrypt(
          {
            name: "AES-GCM",
            iv: toArrayBuffer(decodeBase64(state.wrapper.iv)),
            additionalData: toArrayBuffer(
              buildWebCryptoDeviceBoundAdditionalData(state.subjectHash)
            ),
          },
          storedKey.key,
          toArrayBuffer(decodeBase64(state.wrapper.ciphertext))
        ),
        signal
      )
    );

    return rootKeyBytes.byteLength === 32 ? rootKeyBytes : null;
  } catch {
    throwIfVaultOperationAborted(signal);
    return null;
  }
}

async function encryptVaultRootKeyBytes(
  rootKeyBytes: Uint8Array,
  subjectHash: string,
  signal?: AbortSignal
): Promise<AuthVaultStateEnvelopeV2 | null> {
  const nativeBridge = await getNativeDeviceBoundVaultBridge(signal);
  throwIfVaultOperationAborted(signal);

  if (nativeBridge) {
    const nativeDeviceBoundState = await awaitVaultOperation(
      encryptNativeDeviceBoundVaultRootKeyBytes(
        rootKeyBytes,
        subjectHash,
        nativeBridge
      ),
      signal
    );

    if (nativeDeviceBoundState) {
      return nativeDeviceBoundState;
    }
  }

  if (isCapacitorNativeRuntime()) {
    return encryptWebCryptoDeviceBoundVaultRootKeyBytes(
      rootKeyBytes,
      subjectHash,
      signal
    );
  }

  return encryptBrowserSessionWrappedVaultRootKeyBytes(
    rootKeyBytes,
    subjectHash
  );
}

async function decryptVaultRootKeyBytes(
  state: AuthVaultStateEnvelope,
  signal?: AbortSignal
): Promise<VaultRootKeyDecryptionResult> {
  if (state.version === AUTH_VAULT_LEGACY_VERSION) {
    return decryptLegacyVaultRootKeyBytes(state);
  }

  if (state.wrapper.kind === "native-device-bound") {
    const nativeBridge = await getNativeDeviceBoundVaultBridge(signal);

    return {
      rootKeyBytes: nativeBridge
        ? await awaitVaultOperation(
            decryptNativeDeviceBoundVaultRootKeyBytes(state, nativeBridge),
            signal
          )
        : null,
      keyMaterialUsed: null,
    };
  }

  if (state.wrapper.kind === "webcrypto-device-bound") {
    return {
      rootKeyBytes: await decryptWebCryptoDeviceBoundVaultRootKeyBytes(
        state,
        signal
      ),
      keyMaterialUsed: null,
    };
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
      version: AUTH_VAULT_RECORD_VERSION,
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
    version: AUTH_VAULT_RECORD_VERSION,
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

function getVaultOrganizationalUnitParentLookupKey(
  parentId: string | null | undefined
): string {
  return parentId ?? ROOT_ORGANIZATIONAL_UNIT_PARENT_LOOKUP_KEY;
}

function buildVaultOrganizationalUnitIndexFields(
  unit: Pick<OrganizationalUnitCacheEntry, "type" | "parent_id">
): VaultOrganizationalUnitIndexFields {
  return {
    type: unit.type,
    parent_id: unit.parent_id ?? null,
    parentLookupKey: getVaultOrganizationalUnitParentLookupKey(unit.parent_id),
  };
}

function needsVaultOrganizationalUnitIndexBackfill(
  record: VaultOrganizationalUnitCacheRecord
): boolean {
  return (
    typeof record.type !== "string" ||
    record.parent_id === undefined ||
    typeof record.parentLookupKey !== "string"
  );
}

async function decryptVaultOrganizationalUnitRecord(
  record: VaultOrganizationalUnitCacheRecord,
  session: VaultSession
): Promise<OrganizationalUnitCacheEntry | null> {
  const decryptedRecord =
    await decryptVaultRecord<OrganizationalUnitCacheEntry>(
      record,
      "organizationalUnitCache",
      session
    );

  if (!decryptedRecord) {
    return null;
  }

  return {
    ...decryptedRecord,
    cachedAt: record.cachedAt,
    lastSynced: record.lastSynced,
  };
}

async function decryptVaultOrganizationalUnitRecords(
  records: VaultOrganizationalUnitCacheRecord[],
  session: VaultSession
): Promise<OrganizationalUnitCacheEntry[]> {
  const invalidIds: string[] = [];
  const decryptedRecords = await Promise.all(
    records.map(async (record) => {
      const decryptedRecord = await decryptVaultOrganizationalUnitRecord(
        record,
        session
      );

      if (!decryptedRecord) {
        invalidIds.push(record.id);
        return null;
      }

      return decryptedRecord;
    })
  );

  if (invalidIds.length > 0) {
    await db.vaultOrganizationalUnitCache.bulkDelete(invalidIds);
  }

  return decryptedRecords.filter(
    (record): record is OrganizationalUnitCacheEntry => record !== null
  );
}

async function ensureVaultOrganizationalUnitIndexes(
  session: VaultSession
): Promise<void> {
  if (isVaultOrgUnitIndexEnsured()) {
    return;
  }

  const legacyRecords = await db.vaultOrganizationalUnitCache
    .filter(needsVaultOrganizationalUnitIndexBackfill)
    .toArray();

  if (legacyRecords.length === 0) {
    markVaultOrgUnitIndexEnsured();
    return;
  }

  const updates: Array<{
    key: string;
    changes: VaultOrganizationalUnitIndexFields;
  }> = [];
  const invalidIds: string[] = [];

  await Promise.all(
    legacyRecords.map(async (record) => {
      const decryptedRecord = await decryptVaultOrganizationalUnitRecord(
        record,
        session
      );

      if (!decryptedRecord) {
        invalidIds.push(record.id);
        return;
      }

      updates.push({
        key: record.id,
        changes: buildVaultOrganizationalUnitIndexFields(decryptedRecord),
      });
    })
  );

  if (updates.length > 0) {
    await db.vaultOrganizationalUnitCache.bulkUpdate(updates);
  }

  if (invalidIds.length > 0) {
    await db.vaultOrganizationalUnitCache.bulkDelete(invalidIds);
  }

  markVaultOrgUnitIndexEnsured();
}

async function ensureOfflineVaultSession(
  signal?: AbortSignal
): Promise<VaultSession | null> {
  throwIfVaultOperationAborted(signal);
  let activeVaultSession = getActiveOfflineVaultSession<VaultSession>();
  const currentKeyMaterial = getAuthVaultKeyMaterial();
  const storedState = getStoredVaultState();
  const storedWrapperCacheKey = storedState
    ? getStoredVaultWrapperCacheKey(storedState, currentKeyMaterial)
    : null;

  if (activeVaultSession) {
    if (
      storedState &&
      activeVaultSession.subjectHash === storedState.subjectHash
    ) {
      if (
        storedWrapperCacheKey === null ||
        activeVaultSession.wrapperCacheKey === storedWrapperCacheKey
      ) {
        return activeVaultSession;
      }

      activeVaultSession = await maybeRewriteStoredVaultState(
        activeVaultSession,
        storedState,
        signal
      );
      throwIfVaultOperationAborted(signal);
      setActiveOfflineVaultSession(activeVaultSession);

      return activeVaultSession;
    }

    clearOfflineVaultSession();
  }

  if (!storedState) {
    return null;
  }

  const { rootKeyBytes, keyMaterialUsed } = await decryptVaultRootKeyBytes(
    storedState,
    signal
  );
  throwIfVaultOperationAborted(signal);

  if (!rootKeyBytes) {
    if (
      storedState.version === AUTH_VAULT_VERSION &&
      storedState.wrapper.kind === "native-device-bound"
    ) {
      // Native wrapper failures can be transient. Preserve the encrypted vault
      // so a later bridge recovery can unlock it without losing offline data.
      return null;
    }

    await clearInvalidOfflineVaultArtifacts({ signal });
    return null;
  }

  activeVaultSession = {
    rootKeyBytes,
    subjectHash: storedState.subjectHash,
    wrapperCacheKey:
      (keyMaterialUsed
        ? getStoredVaultWrapperCacheKey(storedState, keyMaterialUsed)
        : null) ??
      storedWrapperCacheKey ??
      getSessionWrapperCacheKey(storedState),
  };

  if (
    keyMaterialUsed !== null &&
    storedWrapperCacheKey !== null &&
    activeVaultSession.wrapperCacheKey !== storedWrapperCacheKey
  ) {
    activeVaultSession = await maybeRewriteStoredVaultState(
      activeVaultSession,
      storedState,
      signal
    );
  }

  throwIfVaultOperationAborted(signal);
  setActiveOfflineVaultSession(activeVaultSession);

  return activeVaultSession;
}

async function maybeRewriteStoredVaultState(
  session: VaultSession,
  storedState: AuthVaultStateEnvelope,
  signal?: AbortSignal
): Promise<VaultSession> {
  const currentKeyMaterial = getAuthVaultKeyMaterial();
  const currentStoredWrapperCacheKey = getStoredVaultWrapperCacheKey(
    storedState,
    currentKeyMaterial
  );
  const preferredWrapperKind = (await getNativeDeviceBoundVaultBridge(signal))
    ? "native-device-bound"
    : isCapacitorNativeRuntime()
      ? "webcrypto-device-bound"
      : "browser-session";
  const currentWrapperKind =
    storedState.version === AUTH_VAULT_LEGACY_VERSION
      ? "browser-session"
      : storedState.wrapper.kind;

  if (
    storedState.version === AUTH_VAULT_VERSION &&
    currentWrapperKind === preferredWrapperKind &&
    (currentStoredWrapperCacheKey === null ||
      currentStoredWrapperCacheKey === session.wrapperCacheKey)
  ) {
    return session;
  }

  const rewrittenState = await encryptVaultRootKeyBytes(
    session.rootKeyBytes,
    session.subjectHash,
    signal
  );
  throwIfVaultOperationAborted(signal);

  if (!rewrittenState) {
    return session;
  }

  const rewrittenStateWithLifecycle = preserveVaultInitializationState(
    rewrittenState,
    storedState
  );
  setStoredVaultState(rewrittenStateWithLifecycle);

  // Re-read key material after the async encrypt so wrapperCacheKey is derived
  // from the same key material that encryptVaultRootKeyBytes used internally,
  // reducing drift if XSRF-TOKEN rotated during the await.
  const postWriteKeyMaterial = getAuthVaultKeyMaterial();

  return {
    ...session,
    wrapperCacheKey:
      getStoredVaultWrapperCacheKey(
        rewrittenStateWithLifecycle,
        postWriteKeyMaterial
      ) ?? session.wrapperCacheKey,
  };
}

async function ensureVaultSessionForUser(
  user: PersistedAuthUser,
  signal?: AbortSignal
): Promise<{
  session: VaultSession;
  pendingStoredState: AuthVaultStateEnvelopeV2 | null;
}> {
  throwIfVaultOperationAborted(signal);
  const subjectHash = await computeSubjectHash(user.id);
  throwIfVaultOperationAborted(signal);
  const currentSession = await ensureOfflineVaultSession(signal);
  const existingStoredState = getStoredVaultState();

  if (!currentSession && existingStoredState) {
    throw new Error("Stored auth vault is temporarily unavailable.");
  }

  if (currentSession && currentSession.subjectHash === subjectHash) {
    if (existingStoredState) {
      return {
        session: await maybeRewriteStoredVaultState(
          currentSession,
          existingStoredState,
          signal
        ),
        pendingStoredState: null,
      };
    }

    const recreatedStoredState = await encryptVaultRootKeyBytes(
      currentSession.rootKeyBytes,
      subjectHash,
      signal
    );

    if (!recreatedStoredState) {
      throw new Error("Failed to recreate the auth vault wrapper.");
    }

    return {
      session: currentSession,
      pendingStoredState: recreatedStoredState,
    };
  }

  if (currentSession && currentSession.subjectHash !== subjectHash) {
    await clearOfflineVaultTables({ signal });
    throwIfVaultOperationAborted(signal);
    clearStoredOfflineVaultState();
  }

  const rootKeyBytes = createRandomBytes(32);
  const storedState = await encryptVaultRootKeyBytes(
    rootKeyBytes,
    subjectHash,
    signal
  );
  throwIfVaultOperationAborted(signal);

  if (!storedState) {
    throw new Error(
      "Failed to derive auth vault key due to missing CSRF token/session context."
    );
  }

  const activeVaultSession = {
    rootKeyBytes,
    subjectHash,
    wrapperCacheKey: getSessionWrapperCacheKey(storedState),
  };
  return {
    session: activeVaultSession,
    pendingStoredState: storedState,
  };
}

async function buildEncryptedProfileRecord(
  user: PersistedAuthUser,
  session: VaultSession,
  signal?: AbortSignal
): Promise<EncryptedProfileRecord> {
  throwIfVaultOperationAborted(signal);

  const encryptedRecord = await encryptVaultRecord(
    user,
    "profile",
    PROFILE_RECORD_ID,
    session
  );
  throwIfVaultOperationAborted(signal);

  return {
    id: PROFILE_RECORD_ID,
    ...encryptedRecord,
  } satisfies EncryptedProfileRecord;
}

async function buildLegacyAnalyticsMigrationRecords(
  session: VaultSession,
  signal?: AbortSignal
): Promise<Array<Omit<VaultAnalyticsRecord, "id">>> {
  throwIfVaultOperationAborted(signal);

  const legacyRecords = await awaitVaultOperation(
    db.analytics.toArray(),
    signal
  );
  throwIfVaultOperationAborted(signal);

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
  throwIfVaultOperationAborted(signal);

  return encryptedRecords;
}

async function migrateLegacyAnalyticsRecords(
  session: VaultSession,
  signal?: AbortSignal
): Promise<void> {
  await ensureVaultDatabaseOpen(signal);
  const encryptedRecords = await buildLegacyAnalyticsMigrationRecords(
    session,
    signal
  );

  if (encryptedRecords.length === 0) {
    return;
  }

  await db.transaction("rw", [db.vaultAnalytics, db.analytics], async () => {
    throwIfVaultOperationAborted(signal);
    await awaitVaultOperation(
      db.vaultAnalytics.bulkPut(encryptedRecords),
      signal
    );
    throwIfVaultOperationAborted(signal);
    await awaitVaultOperation(db.analytics.clear(), signal);
    throwIfVaultOperationAborted(signal);
  });
}

async function buildLegacyOrganizationalUnitMigrationRecords(
  session: VaultSession,
  signal?: AbortSignal
): Promise<VaultOrganizationalUnitCacheRecord[]> {
  throwIfVaultOperationAborted(signal);

  const legacyRecords = await awaitVaultOperation(
    db.organizationalUnitCache.toArray(),
    signal
  );
  throwIfVaultOperationAborted(signal);

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
        ...buildVaultOrganizationalUnitIndexFields(record),
        cachedAt: record.cachedAt,
        lastSynced: record.lastSynced,
        ...encryptedPayload,
      } satisfies VaultOrganizationalUnitCacheRecord;
    })
  );
  throwIfVaultOperationAborted(signal);

  return encryptedRecords;
}

async function migrateLegacyOrganizationalUnitRecords(
  session: VaultSession,
  signal?: AbortSignal
): Promise<void> {
  await ensureVaultDatabaseOpen(signal);
  const encryptedRecords = await buildLegacyOrganizationalUnitMigrationRecords(
    session,
    signal
  );

  if (encryptedRecords.length === 0) {
    return;
  }

  await db.transaction(
    "rw",
    [db.vaultOrganizationalUnitCache, db.organizationalUnitCache],
    async () => {
      throwIfVaultOperationAborted(signal);
      await awaitVaultOperation(
        db.vaultOrganizationalUnitCache.bulkPut(encryptedRecords),
        signal
      );
      throwIfVaultOperationAborted(signal);
      await awaitVaultOperation(db.organizationalUnitCache.clear(), signal);
      throwIfVaultOperationAborted(signal);
    }
  );
}

async function persistInitialVaultRecords(
  user: PersistedAuthUser,
  session: VaultSession,
  signal?: AbortSignal,
  shouldCommit?: () => boolean
): Promise<void> {
  await ensureVaultDatabaseOpen(signal);
  throwIfVaultOperationCannotCommit(signal, shouldCommit);

  const [profileRecord, analyticsRecords, organizationalUnitRecords] =
    await Promise.all([
      buildEncryptedProfileRecord(user, session, signal),
      buildLegacyAnalyticsMigrationRecords(session, signal),
      buildLegacyOrganizationalUnitMigrationRecords(session, signal),
    ]);
  throwIfVaultOperationCannotCommit(signal, shouldCommit);

  await db.transaction(
    "rw",
    [
      db.vaultProfile,
      db.vaultAnalytics,
      db.analytics,
      db.vaultOrganizationalUnitCache,
      db.organizationalUnitCache,
    ],
    async () => {
      throwIfVaultOperationCannotCommit(signal, shouldCommit);
      await awaitVaultOperation(db.vaultProfile.put(profileRecord), signal);
      throwIfVaultOperationCannotCommit(signal, shouldCommit);

      if (analyticsRecords.length > 0) {
        await awaitVaultOperation(
          db.vaultAnalytics.bulkPut(analyticsRecords),
          signal
        );
        throwIfVaultOperationCannotCommit(signal, shouldCommit);
        await awaitVaultOperation(db.analytics.clear(), signal);
        throwIfVaultOperationCannotCommit(signal, shouldCommit);
      }

      if (organizationalUnitRecords.length > 0) {
        await awaitVaultOperation(
          db.vaultOrganizationalUnitCache.bulkPut(organizationalUnitRecords),
          signal
        );
        throwIfVaultOperationCannotCommit(signal, shouldCommit);
        await awaitVaultOperation(db.organizationalUnitCache.clear(), signal);
        throwIfVaultOperationCannotCommit(signal, shouldCommit);
      }

      throwIfVaultOperationCannotCommit(signal, shouldCommit);
    }
  );
}

export async function initializeOfflineVault(
  user: PersistedAuthUser,
  options: OfflineVaultOperationOptions = {}
): Promise<void> {
  const { signal, shouldCommit } = options;

  throwIfVaultOperationCannotCommit(signal, shouldCommit);
  const { session, pendingStoredState } = await ensureVaultSessionForUser(
    user,
    signal
  );
  throwIfVaultOperationCannotCommit(signal, shouldCommit);

  if (pendingStoredState) {
    setStoredVaultState({
      ...pendingStoredState,
      initialization: "pending",
    });
    throwIfVaultOperationCannotCommit(signal, shouldCommit);
  }

  await persistInitialVaultRecords(user, session, signal, shouldCommit);
  throwIfVaultOperationCannotCommit(signal, shouldCommit);

  completeVaultInitialization(session.subjectHash);
  setActiveOfflineVaultSession(session);
  localStorage.removeItem("auth_user");
}

export async function readPersistedAuthUserFromVault(
  options: OfflineVaultOperationOptions = {}
): Promise<PersistedAuthUser | null> {
  const session = await ensureOfflineVaultSession(options.signal);
  throwIfVaultOperationAborted(options.signal);

  if (!session) {
    return null;
  }

  await ensureVaultDatabaseOpen(options.signal);
  throwIfVaultOperationAborted(options.signal);

  const storedProfile = await awaitVaultOperation(
    db.vaultProfile.get(PROFILE_RECORD_ID),
    options.signal
  );
  throwIfVaultOperationAborted(options.signal);

  if (!storedProfile) {
    if (isVaultInitializationPending(getStoredVaultState())) {
      return null;
    }

    await clearInvalidOfflineVaultArtifacts(options);
    return null;
  }

  const decryptedUser = await decryptVaultRecord<unknown>(
    storedProfile,
    "profile",
    session
  );
  const sanitizedUser = sanitizePersistedAuthUser(decryptedUser);

  if (!sanitizedUser) {
    if (isVaultInitializationPending(getStoredVaultState())) {
      return null;
    }

    console.error(
      "Failed to parse stored user data:",
      new SyntaxError("Invalid encrypted vault profile payload.")
    );
    await clearInvalidOfflineVaultArtifacts(options);
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
    ...buildVaultOrganizationalUnitIndexFields(unit),
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

  const decryptedRecord = await decryptVaultOrganizationalUnitRecord(
    record,
    session
  );

  if (!decryptedRecord) {
    await db.vaultOrganizationalUnitCache.delete(id);
    return undefined;
  }

  return decryptedRecord;
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

  return decryptVaultOrganizationalUnitRecords(
    await db.vaultOrganizationalUnitCache.toArray(),
    session
  );
}

export async function listVaultOrganizationalUnitsByType(
  type: OrganizationalUnitCacheEntry["type"]
): Promise<OrganizationalUnitCacheEntry[]> {
  const session = await ensureOfflineVaultSession();

  if (!session) {
    return [];
  }

  await ensureVaultDatabaseOpen();

  await migrateLegacyOrganizationalUnitRecords(session);
  await ensureVaultOrganizationalUnitIndexes(session);

  return decryptVaultOrganizationalUnitRecords(
    await db.vaultOrganizationalUnitCache.where("type").equals(type).toArray(),
    session
  );
}

export async function listVaultOrganizationalUnitsByParent(
  parentId: string | null
): Promise<OrganizationalUnitCacheEntry[]> {
  const session = await ensureOfflineVaultSession();

  if (!session) {
    return [];
  }

  await ensureVaultDatabaseOpen();

  await migrateLegacyOrganizationalUnitRecords(session);
  await ensureVaultOrganizationalUnitIndexes(session);

  return decryptVaultOrganizationalUnitRecords(
    await db.vaultOrganizationalUnitCache
      .where("parentLookupKey")
      .equals(getVaultOrganizationalUnitParentLookupKey(parentId))
      .toArray(),
    session
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
