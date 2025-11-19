<!--
SPDX-FileCopyrightText: 2025 SecPal
SPDX-License-Identifier: CC0-1.0
-->

# Implementation Plan: Client-Side File Encryption (Issue #143)

**Issue:** SecPal/frontend#143
**Epic:** SecPal/frontend#64 (PWA Infrastructure)
**Priority:** High (Security-Critical)
**Estimated Effort:** 1-2 weeks
**Created:** 2025-11-19

---

## 📋 Executive Summary

Implement end-to-end client-side file encryption for files shared via Share Target API before upload to backend, ensuring zero-knowledge architecture where the backend cannot decrypt file contents.

---

## ✅ Dependencies Status (All Green)

- ✅ **#140** - Share Target POST method (Merged)
- ✅ **#141** - Backend file upload API (Closed - COMPLETED)
- ✅ **#142** - IndexedDB storage (Closed - COMPLETED)
- ✅ **SecPal/api#174** - Secret Model + CRUD API (Merged)
- ✅ **SecPal/api#175** - File Attachments API (Merged)

**Status:** Ready to start implementation (19.11.2025)

---

## 🎯 Goals

1. **End-to-End Encryption** - Files encrypted before leaving client
2. **Zero-Knowledge Backend** - Server cannot decrypt file contents
3. **Web Crypto API** - Use browser-native cryptography (AES-GCM 256-bit)
4. **Secure Key Management** - Derive file keys from Secret's encryption key
5. **Integrity Verification** - SHA-256 checksums before/after encryption
6. **Test-Driven Development** - Follow TDD mandatory policy (≥80% coverage)

---

## 🔒 Security Requirements

- ⚠️ **NEVER** log or expose encryption keys
- ⚠️ Use secure key derivation (HKDF, not simple hash)
- ⚠️ Verify file integrity (checksum before/after)
- ⚠️ Handle key rotation carefully
- ⚠️ Test against known encryption test vectors
- ⚠️ Consider forward secrecy for future implementations

---

## 📐 Architecture Overview

### Encryption Flow

```text
1. User shares file via Share Target API
   → File stored in IndexedDB (unencrypted, temporary)

2. User selects/creates Secret
   → Derive file encryption key from Secret's master key

3. Encrypt file client-side (Web Crypto API)
   → File blob encrypted with AES-GCM-256
   → Generate IV (12 bytes), auth tag (16 bytes)
   → Calculate checksum (SHA-256)

4. Upload encrypted blob + metadata to backend
   → Backend stores encrypted file as-is (no decryption)
   → Metadata (filename, size, type) encrypted separately

5. Download: Fetch encrypted blob
   → Decrypt client-side with Secret's key
   → Verify checksum
   → Display/download decrypted file
```

### Data Structures

```typescript
// Encrypted file format (stored in backend)
interface EncryptedFileBlob {
  version: 1;
  algorithm: "AES-GCM-256";
  iv: Uint8Array; // 12 bytes (Initialization Vector)
  encryptedData: ArrayBuffer; // Encrypted file contents
  authTag: Uint8Array; // 16 bytes (included in GCM)
}

// File metadata (encrypted separately with Secret's key)
interface FileMetadata {
  filename: string; // Encrypted with Secret's key
  type: string; // MIME type (encrypted)
  size: number; // Original size (before encryption)
  encryptedSize: number; // Size after encryption
  checksum: string; // SHA-256 of ORIGINAL file (hex)
  checksumEncrypted: string; // SHA-256 of ENCRYPTED blob (hex)
}

// IndexedDB queue entry (extended)
interface FileQueueEntry {
  id: string;
  file: Blob; // Original file (unencrypted, temporary)
  encryptedBlob?: Blob; // Encrypted blob (after encryption)
  metadata: FileMetadata;
  uploadState:
    | "pending"
    | "encrypting"
    | "encrypted"
    | "uploading"
    | "failed"
    | "completed";
  secretId?: string;
  encryptionKey?: CryptoKey; // Derived from Secret (non-extractable)
  retryCount: number;
  error?: string;
}
```

---

## 🧪 TDD Implementation Plan (Phase-by-Phase)

### **Phase 1: Crypto Utilities (Week 1, Days 1-2)**

**Goal:** Implement core encryption/decryption functions with comprehensive tests.

#### Step 1.1: Test Vectors Setup

**File:** `src/lib/crypto/testVectors.ts`

```typescript
// Known-answer tests (KAT) for AES-GCM-256
export const TEST_VECTORS = {
  plaintext: new Uint8Array([72, 101, 108, 108, 111]), // "Hello"
  key: new Uint8Array(32), // 32 bytes of zeros
  iv: new Uint8Array(12),  // 12 bytes of zeros
  expectedCiphertext: new Uint8Array([...]), // Known output
  expectedAuthTag: new Uint8Array([...])     // Known auth tag
};
```

#### Step 1.2: Write Tests FIRST (TDD)

**File:** `src/lib/crypto/encryption.test.ts`

```typescript
import { describe, it, expect } from "vitest";
import { encryptFile, decryptFile, deriveFileKey } from "./encryption";
import { TEST_VECTORS } from "./testVectors";

describe("File Encryption", () => {
  it("should encrypt file with AES-GCM-256", async () => {
    const file = new File([TEST_VECTORS.plaintext], "test.txt");
    const key = await crypto.subtle.importKey(
      "raw",
      TEST_VECTORS.key,
      { name: "AES-GCM" },
      false,
      ["encrypt"]
    );

    const encrypted = await encryptFile(file, key);

    expect(encrypted.version).toBe(1);
    expect(encrypted.algorithm).toBe("AES-GCM-256");
    expect(encrypted.iv.length).toBe(12);
    expect(encrypted.encryptedData).toBeInstanceOf(ArrayBuffer);
  });

  it("should decrypt file correctly (roundtrip)", async () => {
    const originalText = "Hello, SecPal!";
    const file = new File([originalText], "test.txt");
    const key = await generateTestKey();

    const encrypted = await encryptFile(file, key);
    const decrypted = await decryptFile(encrypted, key);

    const decryptedText = await decrypted.text();
    expect(decryptedText).toBe(originalText);
    expect(decrypted.name).toBe("test.txt");
  });

  it("should fail to decrypt with wrong key", async () => {
    const file = new File(["secret"], "test.txt");
    const correctKey = await generateTestKey();
    const wrongKey = await generateTestKey();

    const encrypted = await encryptFile(file, correctKey);

    await expect(decryptFile(encrypted, wrongKey)).rejects.toThrow();
  });

  it("should detect tampering (auth tag verification)", async () => {
    const file = new File(["data"], "test.txt");
    const key = await generateTestKey();

    const encrypted = await encryptFile(file, key);

    // Tamper with encrypted data
    const tampered = new Uint8Array(encrypted.encryptedData);
    tampered[0] ^= 1; // Flip one bit
    encrypted.encryptedData = tampered.buffer;

    await expect(decryptFile(encrypted, key)).rejects.toThrow();
  });

  it("should use known test vectors (NIST validation)", async () => {
    const encrypted = await encryptWithTestVector(TEST_VECTORS);
    expect(encrypted.encryptedData).toEqual(TEST_VECTORS.expectedCiphertext);
  });
});

describe("Key Derivation", () => {
  it("should derive file key from secret key using HKDF", async () => {
    const secretKey = await generateTestKey();
    const filename = "test.pdf";

    const fileKey = await deriveFileKey(secretKey, filename);

    expect(fileKey.type).toBe("secret");
    expect(fileKey.extractable).toBe(false);
    expect(fileKey.usages).toContain("encrypt");
    expect(fileKey.usages).toContain("decrypt");
  });

  it("should derive different keys for different filenames", async () => {
    const secretKey = await generateTestKey();

    const key1 = await deriveFileKey(secretKey, "file1.txt");
    const key2 = await deriveFileKey(secretKey, "file2.txt");

    // Keys should be different (compare exports)
    const exported1 = await crypto.subtle.exportKey("raw", key1);
    const exported2 = await crypto.subtle.exportKey("raw", key2);
    expect(exported1).not.toEqual(exported2);
  });

  it("should derive same key for same filename (deterministic)", async () => {
    const secretKey = await generateTestKey();

    const key1 = await deriveFileKey(secretKey, "test.pdf");
    const key2 = await deriveFileKey(secretKey, "test.pdf");

    const exported1 = await crypto.subtle.exportKey("raw", key1);
    const exported2 = await crypto.subtle.exportKey("raw", key2);
    expect(exported1).toEqual(exported2);
  });
});
```

#### Step 1.3: Implement Functions (Make Tests Pass)

**File:** `src/lib/crypto/encryption.ts`

```typescript
/**
 * Encrypt file using AES-GCM-256
 * @param file - File to encrypt
 * @param key - CryptoKey (AES-GCM, 256-bit)
 * @returns Encrypted blob with metadata
 */
export async function encryptFile(
  file: File,
  key: CryptoKey
): Promise<EncryptedFileBlob> {
  // 1. Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // 2. Read file as ArrayBuffer
  const data = await file.arrayBuffer();

  // 3. Encrypt with AES-GCM (auth tag included in output)
  const encryptedData = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
      tagLength: 128, // 16 bytes auth tag
    },
    key,
    data
  );

  // 4. Extract auth tag (last 16 bytes)
  const authTag = new Uint8Array(encryptedData.slice(-16));

  return {
    version: 1,
    algorithm: "AES-GCM-256",
    iv: iv,
    encryptedData: encryptedData,
    authTag: authTag,
  };
}

/**
 * Decrypt encrypted file blob
 * @param blob - Encrypted blob
 * @param key - CryptoKey (same as encryption)
 * @returns Decrypted File object
 */
export async function decryptFile(
  blob: EncryptedFileBlob,
  key: CryptoKey
): Promise<File> {
  // 1. Verify version and algorithm
  if (blob.version !== 1 || blob.algorithm !== "AES-GCM-256") {
    throw new Error("Unsupported encryption format");
  }

  // 2. Decrypt with AES-GCM (auth tag verification automatic)
  try {
    const decryptedData = await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: blob.iv,
        tagLength: 128,
      },
      key,
      blob.encryptedData
    );

    // 3. Return as File object
    return new File([decryptedData], "decrypted.bin");
  } catch (error) {
    throw new Error("Decryption failed (wrong key or tampered data)");
  }
}

/**
 * Derive file encryption key from secret master key using HKDF
 * @param secretKey - Secret's master key
 * @param filename - Filename (used as salt for key derivation)
 * @returns Derived CryptoKey for file encryption
 */
export async function deriveFileKey(
  secretKey: CryptoKey,
  filename: string
): Promise<CryptoKey> {
  // 1. Hash filename to create salt
  const salt = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(filename)
  );

  // 2. Derive key using HKDF (HMAC-based Extract-and-Expand)
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: "HKDF",
      hash: "SHA-256",
      salt: salt,
      info: new TextEncoder().encode("file-encryption"),
    },
    secretKey,
    256 // 256 bits = 32 bytes for AES-256
  );

  // 3. Import as AES-GCM key
  return crypto.subtle.importKey(
    "raw",
    derivedBits,
    { name: "AES-GCM" },
    false, // Non-extractable (never leaves secure storage)
    ["encrypt", "decrypt"]
  );
}
```

#### Step 1.4: Checksum Utilities (Tests First)

**File:** `src/lib/crypto/checksum.test.ts`

```typescript
describe("File Checksum", () => {
  it("should calculate SHA-256 checksum of file", async () => {
    const file = new File(["Hello"], "test.txt");
    const checksum = await calculateChecksum(file);

    expect(checksum).toBe(
      "185f8db32271fe25f561a6fc938b2e264306ec304eda518007d1764826381969"
    );
  });

  it("should detect file modifications", async () => {
    const file1 = new File(["data"], "test.txt");
    const file2 = new File(["data2"], "test.txt");

    const checksum1 = await calculateChecksum(file1);
    const checksum2 = await calculateChecksum(file2);

    expect(checksum1).not.toBe(checksum2);
  });

  it("should verify checksum correctly", async () => {
    const file = new File(["test"], "test.txt");
    const checksum = await calculateChecksum(file);

    expect(await verifyChecksum(file, checksum)).toBe(true);
    expect(await verifyChecksum(file, "wrong-checksum")).toBe(false);
  });
});
```

**File:** `src/lib/crypto/checksum.ts`

```typescript
/**
 * Calculate SHA-256 checksum of file
 * @param file - File or Blob to hash
 * @returns Hex-encoded checksum
 */
export async function calculateChecksum(file: File | Blob): Promise<string> {
  const data = await file.arrayBuffer();
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Verify file checksum
 * @param file - File to verify
 * @param expectedChecksum - Expected checksum (hex)
 * @returns True if checksum matches
 */
export async function verifyChecksum(
  file: File | Blob,
  expectedChecksum: string
): Promise<boolean> {
  const actualChecksum = await calculateChecksum(file);
  return actualChecksum === expectedChecksum;
}
```

**Acceptance Criteria Phase 1:**

- ✅ All tests passing (≥15 tests)
- ✅ Known test vectors validated
- ✅ Roundtrip encryption/decryption works
- ✅ Tampering detection works
- ✅ Key derivation deterministic
- ✅ Checksum verification works
- ✅ Code coverage ≥80%

---

### **Phase 2: ShareTarget Integration (Week 1, Days 3-4)**

**Goal:** Integrate encryption into Share Target flow with progress indicators.

#### Step 2.1: Write Integration Tests FIRST

**File:** `src/pages/ShareTarget.test.tsx` (extend existing)

```typescript
describe('ShareTarget - File Encryption', () => {
  it('should encrypt files before adding to IndexedDB queue', async () => {
    const mockFile = new File(['secret data'], 'confidential.pdf');
    const mockSecretKey = await generateTestKey();

    render(<ShareTarget />);

    // Simulate file share
    await shareFiles([mockFile]);

    // Select secret
    const secretSelector = screen.getByLabelText('Select Secret');
    fireEvent.change(secretSelector, { target: { value: 'secret-123' } });

    // Click "Encrypt & Save"
    const saveButton = screen.getByRole('button', { name: /encrypt & save/i });
    fireEvent.click(saveButton);

    // Wait for encryption
    await waitFor(() => {
      expect(screen.getByText(/encrypted/i)).toBeInTheDocument();
    });

    // Verify file in IndexedDB is encrypted
    const queueEntry = await fileQueueDB.get(mockFile.name);
    expect(queueEntry.encryptedBlob).toBeDefined();
    expect(queueEntry.uploadState).toBe('encrypted');
  });

  it('should show encryption progress indicator', async () => {
    const largeFile = createMockFile(5 * 1024 * 1024); // 5MB

    render(<ShareTarget />);
    await shareFiles([largeFile]);

    const saveButton = screen.getByRole('button', { name: /encrypt & save/i });
    fireEvent.click(saveButton);

    // Progress indicator should appear
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(screen.getByText(/encrypting/i)).toBeInTheDocument();
  });

  it('should handle encryption errors gracefully', async () => {
    const mockFile = new File(['data'], 'test.txt');

    // Mock encryption failure
    vi.spyOn(crypto.subtle, 'encrypt').mockRejectedValue(new Error('Crypto not supported'));

    render(<ShareTarget />);
    await shareFiles([mockFile]);

    const saveButton = screen.getByRole('button', { name: /encrypt & save/i });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/encryption failed/i)).toBeInTheDocument();
    });
  });

  it('should not expose encryption keys in console/errors', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const mockFile = new File(['secret'], 'test.txt');

    render(<ShareTarget />);
    await shareFiles([mockFile]);

    const saveButton = screen.getByRole('button', { name: /encrypt & save/i });
    fireEvent.click(saveButton);

    await waitFor(() => screen.getByText(/encrypted/i));

    // Verify no keys logged
    expect(consoleSpy).not.toHaveBeenCalledWith(expect.stringContaining('CryptoKey'));
  });
});
```

#### Step 2.2: Update ShareTarget Component

**File:** `src/pages/ShareTarget.tsx`

```typescript
import { encryptFile, deriveFileKey } from '@/lib/crypto/encryption';
import { calculateChecksum } from '@/lib/crypto/checksum';
import { useFileQueue } from '@/hooks/useFileQueue';

export function ShareTarget() {
  const [selectedSecretId, setSelectedSecretId] = useState<string | null>(null);
  const [encryptionProgress, setEncryptionProgress] = useState<Map<string, number>>(new Map());
  const [encryptionErrors, setEncryptionErrors] = useState<Map<string, string>>(new Map());
  const { addToQueue } = useFileQueue();

  async function handleEncryptAndSave() {
    if (!sharedData?.files || !selectedSecretId) return;

    for (const file of sharedData.files) {
      try {
        setEncryptionProgress(prev => new Map(prev).set(file.name, 0));

        // 1. Get Secret's master key (from Secret Management API)
        const secretKey = await getSecretMasterKey(selectedSecretId);

        // 2. Derive file-specific key
        const fileKey = await deriveFileKey(secretKey, file.name);

        setEncryptionProgress(prev => new Map(prev).set(file.name, 25));

        // 3. Calculate original checksum
        const originalChecksum = await calculateChecksum(file);

        setEncryptionProgress(prev => new Map(prev).set(file.name, 50));

        // 4. Encrypt file
        const encryptedBlob = await encryptFile(file, fileKey);

        setEncryptionProgress(prev => new Map(prev).set(file.name, 75));

        // 5. Calculate encrypted checksum
        const encryptedChecksum = await calculateChecksum(
          new Blob([encryptedBlob.encryptedData])
        );

        // 6. Add to IndexedDB queue
        await addToQueue({
          id: crypto.randomUUID(),
          file: file, // Original (will be deleted after upload)
          encryptedBlob: new Blob([encryptedBlob.encryptedData]),
          metadata: {
            filename: file.name,
            type: file.type,
            size: file.size,
            encryptedSize: encryptedBlob.encryptedData.byteLength,
            checksum: originalChecksum,
            checksumEncrypted: encryptedChecksum
          },
          uploadState: 'encrypted',
          secretId: selectedSecretId,
          encryptionKey: fileKey,
          retryCount: 0
        });

        setEncryptionProgress(prev => new Map(prev).set(file.name, 100));
      } catch (error) {
        console.error('Encryption failed:', error);
        setEncryptionErrors(prev =>
          new Map(prev).set(file.name, error.message)
        );
      }
    }
  }

  return (
    <div>
      {/* Existing file list UI */}

      {/* Secret selector */}
      <select onChange={(e) => setSelectedSecretId(e.target.value)}>
        <option value="">Select Secret</option>
        {/* Secret list from API */}
      </select>

      {/* Encrypt & Save button */}
      <button onClick={handleEncryptAndSave}>
        🔐 Encrypt & Save to Secret
      </button>

      {/* Progress indicators */}
      {Array.from(encryptionProgress.entries()).map(([filename, progress]) => (
        <div key={filename}>
          <progress value={progress} max={100} />
          <span>{filename}: {progress}%</span>
        </div>
      ))}

      {/* Error display */}
      {Array.from(encryptionErrors.entries()).map(([filename, error]) => (
        <div key={filename} className="text-red-600">
          ❌ {filename}: {error}
        </div>
      ))}
    </div>
  );
}
```

**Acceptance Criteria Phase 2:**

- ✅ Files encrypted before IndexedDB storage
- ✅ Progress indicators work
- ✅ Error handling graceful
- ✅ No keys logged to console
- ✅ All tests passing
- ✅ Code coverage ≥80%

---

### **Phase 3: Upload Integration (Week 2, Days 1-2)**

**Goal:** Upload encrypted blobs to backend with metadata.

#### Step 3.1: Write Upload Tests FIRST

**File:** `src/services/secretApi.test.ts`

```typescript
describe('Secret API - Encrypted File Upload', () => {
  it('should upload encrypted blob to backend', async () => {
    const encryptedBlob = new Blob([new Uint8Array([1, 2, 3])]);
    const metadata = {
      filename: 'test.pdf',
      type: 'application/pdf',
      size: 1024,
      encryptedSize: 128,
      checksum: 'abc123',
      checksumEncrypted: 'def456'
    };

    const response = await uploadEncryptedAttachment('secret-123', encryptedBlob, metadata);

    expect(response.data.id).toBeDefined();
    expect(response.data.filename).toBe('test.pdf');
  });

  it('should include metadata in upload', async () => {
    const mock = mockFetch();

    await uploadEncryptedAttachment('secret-123', new Blob(), {...});

    expect(mock).toHaveBeenCalledWith(
      expect.stringContaining('/secrets/secret-123/attachments'),
      expect.objectContaining({
        method: 'POST',
        body: expect.any(FormData)
      })
    );

    const formData = mock.mock.calls[0][1].body;
    expect(formData.get('metadata')).toContain('checksum');
  });
});
```

#### Step 3.2: Implement Upload Function

**File:** `src/services/secretApi.ts`

```typescript
/**
 * Upload encrypted file attachment to Secret
 * @param secretId - Secret UUID
 * @param encryptedBlob - Encrypted file blob
 * @param metadata - File metadata (encrypted separately)
 * @returns Upload response
 */
export async function uploadEncryptedAttachment(
  secretId: string,
  encryptedBlob: Blob,
  metadata: FileMetadata
): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("file", encryptedBlob, "encrypted.bin");
  formData.append("metadata", JSON.stringify(metadata));

  const response = await fetch(`/api/v1/secrets/${secretId}/attachments`, {
    method: "POST",
    headers: getAuthHeaders(), // No Content-Type for FormData
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Upload failed: ${response.statusText}`);
  }

  return response.json();
}
```

**Acceptance Criteria Phase 3:**

- ✅ Encrypted blobs uploaded to backend
- ✅ Metadata included in upload
- ✅ Upload errors handled
- ✅ All tests passing
- ✅ Code coverage ≥80%

---

### **Phase 4: Download & Decryption (Week 2, Days 3-4)**

**Goal:** Download encrypted files and decrypt client-side for preview/download.

#### Step 4.1: Write Decryption Tests FIRST

**File:** `src/services/secretApi.test.ts` (extend)

```typescript
describe("Secret API - Encrypted File Download", () => {
  it("should download and decrypt file", async () => {
    const attachmentId = "attachment-123";
    const secretKey = await generateTestKey();

    const decryptedFile = await downloadAndDecryptAttachment(
      attachmentId,
      secretKey
    );

    expect(decryptedFile).toBeInstanceOf(File);
    expect(decryptedFile.name).toBe("document.pdf");
  });

  it("should verify checksum after decryption", async () => {
    const mockEncryptedBlob = createMockEncryptedBlob();
    const secretKey = await generateTestKey();

    const result = await downloadAndDecryptAttachment("id", secretKey);

    expect(result.checksumValid).toBe(true);
  });

  it("should reject tampered files", async () => {
    const tamperedBlob = createTamperedBlob();

    await expect(downloadAndDecryptAttachment("id", secretKey)).rejects.toThrow(
      "Checksum verification failed"
    );
  });
});
```

#### Step 4.2: Implement Download & Decryption

**File:** `src/services/secretApi.ts` (extend)

```typescript
/**
 * Download and decrypt file attachment
 * @param attachmentId - Attachment UUID
 * @param secretKey - Secret's master key
 * @returns Decrypted file
 */
export async function downloadAndDecryptAttachment(
  attachmentId: string,
  secretKey: CryptoKey
): Promise<File> {
  // 1. Download encrypted blob + metadata
  const response = await fetch(`/api/v1/attachments/${attachmentId}/download`);
  if (!response.ok) throw new Error("Download failed");

  const { encryptedBlob, metadata } = await response.json();

  // 2. Derive file key (same as encryption)
  const fileKey = await deriveFileKey(secretKey, metadata.filename);

  // 3. Decrypt blob
  const decryptedFile = await decryptFile(encryptedBlob, fileKey);

  // 4. Verify checksum
  const checksum = await calculateChecksum(decryptedFile);
  if (checksum !== metadata.checksum) {
    throw new Error(
      "Checksum verification failed (file corrupted or tampered)"
    );
  }

  // 5. Restore original filename
  return new File([decryptedFile], metadata.filename, { type: metadata.type });
}
```

**Acceptance Criteria Phase 4:**

- ✅ Encrypted files downloaded
- ✅ Decryption works correctly
- ✅ Checksum verification enforced
- ✅ Tampering detected
- ✅ All tests passing
- ✅ Code coverage ≥80%

---

### **Phase 5: Security Audit & Documentation (Week 2, Day 5)**

**Goal:** Security review, documentation, and final testing.

#### Step 5.1: Security Checklist

- [ ] **Key Management**
  - [ ] Keys never logged or exposed
  - [ ] Keys non-extractable (Web Crypto API)
  - [ ] HKDF used for key derivation (not simple hash)
  - [ ] Unique IV for each encryption operation

- [ ] **Encryption**
  - [ ] AES-GCM-256 with 128-bit auth tag
  - [ ] Known test vectors validated
  - [ ] Tampering detection works (auth tag)

- [ ] **Integrity**
  - [ ] SHA-256 checksums before/after encryption
  - [ ] Checksum verification enforced on download
  - [ ] File corruption detected

- [ ] **Error Handling**
  - [ ] Decryption failures handled gracefully
  - [ ] User-friendly error messages (no key exposure)
  - [ ] Network failures don't expose keys

- [ ] **Testing**
  - [ ] ≥80% code coverage
  - [ ] Known test vectors pass
  - [ ] Roundtrip encryption/decryption works
  - [ ] Tampering detection works
  - [ ] Edge cases covered (large files, network errors)

#### Step 5.2: Documentation Updates

**File:** `frontend/docs/CRYPTO_ARCHITECTURE.md` (NEW)

```markdown
# Client-Side Encryption Architecture

## Overview

SecPal implements end-to-end encryption for file attachments using Web Crypto API with AES-GCM-256.

## Key Hierarchy
```

User Master Key (from authentication)
└─> Secret Master Key (per Secret)
└─> File Encryption Key (derived via HKDF + filename salt)

```text

## Encryption Flow

1. User shares file via Share Target API
2. Derive file key from Secret's master key (HKDF)
3. Encrypt file with AES-GCM-256 (random IV)
4. Calculate checksums (before/after)
5. Upload encrypted blob to backend
6. Backend stores encrypted file (cannot decrypt)

## Security Guarantees

- **Zero-Knowledge Backend**: Server cannot decrypt files
- **End-to-End Encryption**: Only client can decrypt
- **Integrity Verification**: SHA-256 checksums + GCM auth tag
- **Tampering Detection**: Modified files rejected
- **Forward Secrecy**: Unique IV per encryption

## API

See `src/lib/crypto/encryption.ts` for implementation details.
```

**Update:** `frontend/README.md` (add encryption section)
**Update:** `frontend/CHANGELOG.md` (add Phase 3 encryption feature)

**Acceptance Criteria Phase 5:**

- ✅ Security checklist complete
- ✅ Documentation comprehensive
- ✅ CHANGELOG updated
- ✅ README updated
- ✅ No security vulnerabilities found

---

## 📦 Deliverables Checklist

### Code

- [ ] `src/lib/crypto/encryption.ts` (AES-GCM implementation)
- [ ] `src/lib/crypto/encryption.test.ts` (≥15 tests)
- [ ] `src/lib/crypto/checksum.ts` (SHA-256 utilities)
- [ ] `src/lib/crypto/checksum.test.ts` (≥5 tests)
- [ ] `src/lib/crypto/testVectors.ts` (known-answer tests)
- [ ] `src/pages/ShareTarget.tsx` (encryption integration)
- [ ] `src/pages/ShareTarget.test.tsx` (≥10 new tests)
- [ ] `src/services/secretApi.ts` (upload/download functions)
- [ ] `src/services/secretApi.test.ts` (≥8 tests)
- [ ] `src/hooks/useFileQueue.ts` (IndexedDB integration)

### Documentation

- [ ] `docs/CRYPTO_ARCHITECTURE.md` (NEW)
- [ ] `README.md` (encryption section)
- [ ] `CHANGELOG.md` (Phase 3 encryption feature)
- [ ] `PWA_PHASE3_TESTING.md` (encryption test scenarios)

### Tests

- [ ] **Total Tests:** ≥38 new tests (encryption + integration)
- [ ] **Coverage:** ≥80% for all crypto code
- [ ] **Security Tests:** ≥7 tests (key exposure, tampering, etc.)
- [ ] **Test Vectors:** NIST-validated known-answer tests

### Quality Gates

- [ ] All tests passing (Vitest)
- [ ] TypeScript strict mode clean
- [ ] ESLint clean (no warnings)
- [ ] Prettier formatted
- [ ] REUSE compliant (SPDX headers)
- [ ] Domain policy compliant (secpal.app/secpal.dev)
- [ ] PHPStan/CodeQL passing (if applicable)
- [ ] 4-Pass Self-Review completed

---

## 🚀 Branch Strategy

```bash
# Create feature branch
git checkout main
git pull
git checkout -b feat/client-side-file-encryption

# Follow TDD cycle for each phase
# 1. Write tests FIRST
# 2. Implement code (make tests pass)
# 3. Refactor (keep tests green)
# 4. Commit with signed commits

# Example commit messages
git commit -S -m "test: add encryption test vectors (Phase 1.1)"
git commit -S -m "feat: implement AES-GCM file encryption (Phase 1.3)"
git commit -S -m "test: add ShareTarget encryption integration tests (Phase 2.1)"
git commit -S -m "feat: integrate encryption into ShareTarget (Phase 2.2)"

# Create PR as DRAFT
gh pr create --draft --title "feat: client-side file encryption (Issue #143)" \
  --body "Closes #143\n\nPhase 1-5 complete (TDD)\n\nSee docs/IMPLEMENTATION_PLAN_ISSUE143.md"

# After self-review (4-pass)
gh pr ready
```

---

## 📏 PR Rules

- **Size Target:** ~800-1000 LOC (large PR justified - atomic encryption feature)
- **One Topic:** File encryption only (no mixing with other features)
- **Tests First:** TDD enforced (tests written before implementation)
- **Coverage:** ≥80% for new code
- **Self-Review:** 4-pass review BEFORE marking ready
- **DRAFT → Ready:** Only after ZERO issues found locally

---

## ⚠️ Risk Mitigation

### Risk 1: Web Crypto API Browser Support

**Mitigation:** Check `crypto.subtle` availability, show error if not supported (HTTPS required)

### Risk 2: Large File Performance

**Mitigation:** Show progress indicator, consider chunked encryption for files >10MB (future)

### Risk 3: Key Management Complexity

**Mitigation:** Comprehensive tests, HKDF with deterministic derivation, non-extractable keys

### Risk 4: Backend API Changes

**Mitigation:** Backend API already stable (SecPal/api#175 merged), coordinate with backend team

---

## 📞 Support & Questions

- **Backend Team:** Coordinate on encrypted file format if backend changes needed
- **Security Review:** Request security audit before merging
- **Performance:** Profile encryption with large files (5MB+)

---

## ✅ Success Metrics

- [ ] **Zero-Knowledge:** Backend cannot decrypt files ✅
- [ ] **Security:** CodeQL clean, no key exposure ✅
- [ ] **Tests:** ≥38 new tests, ≥80% coverage ✅
- [ ] **Performance:** <500ms encryption for 5MB file ✅
- [ ] **UX:** Progress indicators work smoothly ✅
- [ ] **Documentation:** Architecture documented ✅

---

**Plan Status:** Ready for implementation
**Next Step:** Create branch `feat/client-side-file-encryption` and start Phase 1
**Expected Completion:** 2025-12-03 (2 weeks)
