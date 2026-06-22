// AES-256-GCM shim for capacitor-plugin-simple-encryption.
// Salt stored in OS keychain (DPAPI/Keychain/libsecret). Biometric key stored
// via tauri-plugin-biometry (Touch ID on macOS, Windows Hello on Windows).
// Linux: keychain works, biometric gracefully unavailable.
import {
  setPassword,
  getPassword,
  deletePassword,
} from "tauri-plugin-keyring-api";
import {
  checkStatus,
  setData,
  getData,
  hasData,
  removeData,
} from "@choochmeque/tauri-plugin-biometry-api";

const ALG = "AES-GCM";
const KEY_LEN = 256;
const IV_LEN = 12;
const SALT_LEN = 16;
const PBKDF2_ITER = 200_000;
const KEYRING_SERVICE = "cash.selene.app";
const KEYRING_SALT_ACCOUNT = "selene-key-salt";
const BIO_DOMAIN = "cash.selene.app";
const BIO_KEY_NAME = "selene-enc-key";
const DEFAULT_PIN = "selene-desktop-default";

let _key: CryptoKey | null = null;
let _salt: Uint8Array | null = null;

// ─── helpers ──────────────────────────────────────────────────────────────────

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64(buf: ArrayBuffer | Uint8Array): string {
  const arr = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  return btoa(String.fromCharCode(...arr));
}

async function loadOrCreateSalt(): Promise<Uint8Array> {
  try {
    const stored = await getPassword(KEYRING_SERVICE, KEYRING_SALT_ACCOUNT);
    if (stored) return b64ToBytes(stored);
  } catch {
    // No entry yet — create below
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  await setPassword(KEYRING_SERVICE, KEYRING_SALT_ACCOUNT, bytesToB64(salt));
  return salt;
}

async function deriveKey(pin: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(pin),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" },
    baseKey,
    { name: ALG, length: KEY_LEN },
    true,
    ["encrypt", "decrypt"]
  );
}

async function importRawKey(
  keyB64: string,
  usages: KeyUsage[] = ["encrypt", "decrypt"]
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    b64ToBytes(keyB64),
    { name: ALG, length: KEY_LEN },
    true,
    usages
  );
}

async function exportKey(key: CryptoKey): Promise<string> {
  return bytesToB64(await crypto.subtle.exportKey("raw", key));
}

async function aeEncrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
  const enc = new TextEncoder();
  const ciphertext = await crypto.subtle.encrypt({ name: ALG, iv }, key, enc.encode(plaintext));
  const combined = new Uint8Array(IV_LEN + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), IV_LEN);
  return bytesToB64(combined);
}

async function aeDecrypt(key: CryptoKey, b64: string): Promise<string> {
  const combined = b64ToBytes(b64);
  const iv = combined.slice(0, IV_LEN);
  const ciphertext = combined.slice(IV_LEN);
  const plain = await crypto.subtle.decrypt({ name: ALG, iv }, key, ciphertext);
  return new TextDecoder().decode(plain);
}

function requireKey(): CryptoKey {
  if (!_key) throw new Error("SimpleEncryption not initialized — call initialize() first");
  return _key;
}

// ─── public API ───────────────────────────────────────────────────────────────

export const SimpleEncryption = {
  async initialize(options?: { pin?: string }): Promise<{ isReady: boolean; hasPinConfigured: boolean }> {
    const pin = options?.pin ?? DEFAULT_PIN;
    _salt = await loadOrCreateSalt();
    _key = await deriveKey(pin, _salt);
    return { isReady: true, hasPinConfigured: !!options?.pin };
  },

  async encrypt(options: { data: string }): Promise<{ data: string }> {
    return { data: await aeEncrypt(requireKey(), options.data) };
  },

  async decrypt(options: { data: string }): Promise<{ data: string }> {
    return { data: await aeDecrypt(requireKey(), options.data) };
  },

  async decryptWithExplicitKey(options: { data: string; key: string | null }): Promise<{ data: string }> {
    const key = options.key ? await importRawKey(options.key, ["decrypt"]) : requireKey();
    return { data: await aeDecrypt(key, options.data) };
  },

  async exportCurrentKey(): Promise<{ key: string }> {
    return { key: await exportKey(requireKey()) };
  },

  async loadKeyIntoMemory(options: { key: string }): Promise<void> {
    _key = await importRawKey(options.key);
  },

  async replaceKey(options: { key: string }): Promise<void> {
    _key = await importRawKey(options.key);
  },

  async verifyPin(options: { pin: string }): Promise<{ isValid: boolean }> {
    if (!_key || !_salt) return { isValid: false };
    try {
      const candidateKey = await deriveKey(options.pin, _salt);
      const a = await exportKey(_key);
      const b = await exportKey(candidateKey);
      return { isValid: a === b };
    } catch {
      return { isValid: false };
    }
  },

  async setPin(options: { newPin: string }): Promise<void> {
    if (!_salt) throw new Error("SimpleEncryption not initialized");
    _key = await deriveKey(options.newPin, _salt);
  },

  async removePin(): Promise<void> {
    if (!_salt) throw new Error("SimpleEncryption not initialized");
    _key = await deriveKey(DEFAULT_PIN, _salt);
  },

  async clearKeyFromMemory(): Promise<void> {
    _key = null;
  },

  // ── biometric — real on macOS/Windows, graceful stub on Linux ─────────────

  async isBiometricAvailable(): Promise<{ value: boolean }> {
    try {
      const status = await checkStatus();
      return { value: status.isAvailable };
    } catch {
      return { value: false };
    }
  },

  async hasBiometricKey(): Promise<{ value: boolean }> {
    try {
      const available = await hasData({ domain: BIO_DOMAIN, name: BIO_KEY_NAME });
      return { value: available };
    } catch {
      return { value: false };
    }
  },

  // Stores the current AES key in biometric-gated secure storage.
  // macOS: Keychain item gated by LAContext / Touch ID.
  // Windows: WebAuthn PRF + Credential Manager (Windows Hello).
  // Linux: throws — caller should check isBiometricAvailable() first.
  async storeBiometricKeyFromCurrent(): Promise<void> {
    const keyB64 = await exportKey(requireKey());
    await setData({ domain: BIO_DOMAIN, name: BIO_KEY_NAME, data: keyB64 });
  },

  async storeBiometricKey(options: { key: string }): Promise<void> {
    await setData({ domain: BIO_DOMAIN, name: BIO_KEY_NAME, data: options.key });
  },

  // Retrieves and loads the AES key after biometric authentication.
  async loadBiometricKey(_options?: unknown): Promise<{ key: string }> {
    const response = await getData({
      domain: BIO_DOMAIN,
      name: BIO_KEY_NAME,
      reason: "Unlock Selene Wallet",
    });
    _key = await importRawKey(response.data);
    return { key: response.data };
  },

  async removeBiometricKey(): Promise<void> {
    try {
      await removeData({ domain: BIO_DOMAIN, name: BIO_KEY_NAME });
    } catch {
      // Already absent — not an error
    }
  },

  async verifyBiometric(_options?: unknown): Promise<void> {
    // Standalone biometric verification without key retrieval.
    // getData already performs biometric auth, so just attempt it.
    await getData({
      domain: BIO_DOMAIN,
      name: BIO_KEY_NAME,
      reason: "Verify your identity",
    });
  },

  // ── key backup / restore ───────────────────────────────────────────────────

  async exportKeyBackup(options: { password: string }): Promise<{ data: string }> {
    const currentKeyB64 = await exportKey(requireKey());
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
    const backupKey = await deriveKey(options.password, salt);
    const enc = await aeEncrypt(backupKey, currentKeyB64);
    return { data: bytesToB64(salt) + "." + enc };
  },

  async importKeyBackup(options: { data: string; password: string }): Promise<void> {
    const [saltB64, enc] = options.data.split(".");
    const salt = b64ToBytes(saltB64);
    const backupKey = await deriveKey(options.password, salt);
    const rawKeyB64 = await aeDecrypt(backupKey, enc);
    _key = await importRawKey(rawKeyB64);
  },

  // ── misc ──────────────────────────────────────────────────────────────────

  async openAppSettings(): Promise<void> {},

  async setKeyStorageSettings(_options: { deviceOnly: boolean }): Promise<void> {},

  async resetAll(): Promise<void> {
    _key = null;
    _salt = null;
    try { await deletePassword(KEYRING_SERVICE, KEYRING_SALT_ACCOUNT); } catch {}
    try { await removeData({ domain: BIO_DOMAIN, name: BIO_KEY_NAME }); } catch {}
  },
};
