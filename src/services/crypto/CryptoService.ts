/**
 * NEXA NautaX — CryptoService 
 * Modo Conveniente + restoreKeyFromSession en getState()
 */

import { STORAGE_KEYS } from '@/storage/namespaces';
import { getStorageDriver } from '@/storage/driver/chromeStorageDriver';

const PBKDF2_ITERATIONS = 250_000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const VERIFIER_PLAINTEXT = 'NEXA_VERIFIER_v1';

export interface CryptoState {
  readonly initialized: boolean;
  readonly locked: boolean;
  readonly createdAt: number | null;
}

interface CryptoVerifier {
  readonly salt: string;
  readonly verifier: string;
  readonly iterations: number;
  readonly createdAt: number;
}

class CryptoServiceImpl {
  private aesKey: CryptoKey | null = null;
  private failCount = 0;
  private cooldownUntil = 0;

  async isInitialized(): Promise<boolean> {
    const driver = getStorageDriver();
    const verifier = await driver.getLocal<CryptoVerifier>(STORAGE_KEYS.CRYPTO_VERIFIER);
    return verifier !== null;
  }

  async getState(): Promise<CryptoState> {
    const initialized = await this.isInitialized();
    const verifier = await getStorageDriver().getLocal<CryptoVerifier>(STORAGE_KEYS.CRYPTO_VERIFIER);
    if (initialized && this.aesKey === null) {
      await this.restoreKeyFromSession();
    }
    return { initialized, locked: this.aesKey === null, createdAt: verifier?.createdAt ?? null };
  }

  isLocked(): boolean {
    return this.aesKey === null;
  }

  async createMasterPassword(masterPassword: string): Promise<void> {
    if (await this.isInitialized()) throw new Error('Crypto already initialized');
    let pwd = masterPassword;
    if (!pwd) {
      const driver = getStorageDriver();
      const meta = await driver.getLocal<{ installationId: string }>(STORAGE_KEYS.META);
      pwd = meta?.installationId ?? crypto.randomUUID();
    }
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const key = await this.deriveKey(pwd, salt);
    const verifierData = new TextEncoder().encode(VERIFIER_PLAINTEXT);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, verifierData);
    const verifier: CryptoVerifier = {
      salt: this.toBase64(salt),
      verifier: this.toBase64(this.concat(iv, new Uint8Array(ciphertext))),
      iterations: PBKDF2_ITERATIONS,
      createdAt: Date.now(),
    };
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.CRYPTO_VERIFIER, verifier);
    this.aesKey = key;
    await this.storeKeyInSession(key);
    this.failCount = 0;
    this.cooldownUntil = 0;
  }

  async unlock(masterPassword: string): Promise<void> {
    if (Date.now() < this.cooldownUntil) {
      throw new Error(`En cooldown. Espera ${Math.ceil((this.cooldownUntil - Date.now()) / 1000)}s`);
    }
    const driver = getStorageDriver();
    const verifier = await driver.getLocal<CryptoVerifier>(STORAGE_KEYS.CRYPTO_VERIFIER);
    if (!verifier) throw new Error('Crypto not initialized');
    let pwd = masterPassword;
    if (!pwd) {
      const meta = await driver.getLocal<{ installationId: string }>(STORAGE_KEYS.META);
      pwd = meta?.installationId ?? crypto.randomUUID();
    }
    const salt = this.fromBase64(verifier.salt);
    const key = await this.deriveKey(pwd, salt, verifier.iterations);
    const verifierData = this.fromBase64(verifier.verifier);
    const iv = verifierData.slice(0, IV_LENGTH);
    const ciphertext = verifierData.slice(IV_LENGTH);
    try {
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
      if (new TextDecoder().decode(decrypted) !== VERIFIER_PLAINTEXT) throw new Error('Mismatch');
    } catch {
      this.failCount++;
      this.updateCooldown();
      throw new Error('Contraseña maestra incorrecta');
    }
    this.aesKey = key;
    await this.storeKeyInSession(key);
    this.failCount = 0;
    this.cooldownUntil = 0;
  }

  async lock(): Promise<void> {
    this.aesKey = null;
    const driver = getStorageDriver();
    await driver.removeSession(STORAGE_KEYS.CRYPTO_AES_KEY);
    await driver.removeSession(STORAGE_KEYS.CRYPTO_DERIVED_AT);
  }

  async changeMasterPassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.unlock(oldPassword);
    const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
    const newKey = await this.deriveKey(newPassword, salt);
    const verifierData = new TextEncoder().encode(VERIFIER_PLAINTEXT);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, newKey, verifierData);
    const verifier: CryptoVerifier = {
      salt: this.toBase64(salt),
      verifier: this.toBase64(this.concat(iv, new Uint8Array(ciphertext))),
      iterations: PBKDF2_ITERATIONS,
      createdAt: Date.now(),
    };
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.CRYPTO_VERIFIER, verifier);
    this.aesKey = newKey;
    await this.storeKeyInSession(newKey);
  }

  async encrypt(plaintext: string): Promise<string> {
    if (!this.aesKey) { await this.restoreKeyFromSession(); if (!this.aesKey) throw new Error('Locked'); }
    const data = new TextEncoder().encode(plaintext);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, this.aesKey, data);
    return this.toBase64(this.concat(iv, new Uint8Array(ciphertext)));
  }

  async decrypt(ciphertext: string): Promise<string> {
    if (!this.aesKey) { await this.restoreKeyFromSession(); if (!this.aesKey) throw new Error('Locked'); }
    const data = this.fromBase64(ciphertext);
    const iv = data.slice(0, IV_LENGTH);
    const ct = data.slice(IV_LENGTH);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, this.aesKey, ct);
    return new TextDecoder().decode(decrypted);
  }

  generateSecureId(): string {
    return Array.from(crypto.getRandomValues(new Uint8Array(8))).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  private async deriveKey(password: string, salt: Uint8Array, iterations: number = PBKDF2_ITERATIONS): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password) as BufferSource, { name: 'PBKDF2' }, false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  }

  private async storeKeyInSession(key: CryptoKey): Promise<void> {
    const raw = await crypto.subtle.exportKey('raw', key);
    const driver = getStorageDriver();
    await driver.setSession(STORAGE_KEYS.CRYPTO_AES_KEY, this.toBase64(new Uint8Array(raw)));
    await driver.setSession(STORAGE_KEYS.CRYPTO_DERIVED_AT, Date.now());
  }

  private async restoreKeyFromSession(): Promise<void> {
    const driver = getStorageDriver();
    const rawBase64 = await driver.getSession<string>(STORAGE_KEYS.CRYPTO_AES_KEY);
    if (!rawBase64) { this.aesKey = null; return; }
    try {
      this.aesKey = await crypto.subtle.importKey('raw', this.fromBase64(rawBase64) as BufferSource, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
    } catch { this.aesKey = null; }
  }

  private updateCooldown(): void {
    if (this.failCount === 3) this.cooldownUntil = Date.now() + 30_000;
    else if (this.failCount === 6) this.cooldownUntil = Date.now() + 300_000;
    else if (this.failCount >= 9) this.cooldownUntil = Date.now() + 1_800_000;
  }

  private toBase64(bytes: Uint8Array): string {
    let b = ''; for (let i = 0; i < bytes.length; i++) b += String.fromCharCode(bytes[i]!);
    return btoa(b);
  }

  private fromBase64(s: string): Uint8Array {
    const b = atob(s); const bytes = new Uint8Array(b.length);
    for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
    return bytes;
  }

  private concat(a: Uint8Array, b: Uint8Array): Uint8Array {
    const r = new Uint8Array(a.length + b.length); r.set(a, 0); r.set(b, a.length); return r;
  }
}

export const cryptoService = new CryptoServiceImpl();
