/**
 * NEXA NautaX — AccountManager
 * Fase 7 — Implementación real
 *
 * CRUD de cuentas Nauta con:
 *  - Cifrado AES-GCM de contraseñas via CryptoService
 *  - Persistencia en chrome.storage.local
 *  - Selección de cuenta activa
 *  - Validación de credenciales via ETECSA Connector
 */

import { STORAGE_KEYS } from '@/storage/namespaces';
import { getStorageDriver } from '@/storage/driver/chromeStorageDriver';
import { cryptoService } from '@/services/crypto/CryptoService';

export interface Account {
  readonly id: string;
  readonly alias: string;
  readonly username: string;
  readonly domain: 'nauta.com.cu' | 'nauta.co.cu';
  readonly encryptedPassword: string;
  readonly type: 'prepaid';
  readonly createdAt: number;
  readonly updatedAt: number;
  readonly lastUsed: number | null;
  readonly avatar?: string | undefined;
}

export interface NewAccountInput {
  readonly alias: string;
  readonly username: string;
  readonly domain: 'nauta.com.cu' | 'nauta.co.cu';
  readonly password: string;
  readonly type: 'prepaid';
  readonly avatar?: string;
}

class AccountManagerImpl {
  private cache: Account[] | null = null;
  private selectedId: string | null = null;

  // —— CRUD ————————————————————————————————————————————————

  async create(input: NewAccountInput): Promise<Account> {
    if (cryptoService.isLocked()) {
      throw new Error('Crypto is locked — unlock first');
    }

    // Validar duplicados
    const existing = await this.list();
    const fullUsername = `${input.username}@${input.domain}`;
    if (existing.some((a) => `${a.username}@${a.domain}` === fullUsername)) {
      throw new Error('Ya existe una cuenta con este usuario');
    }

    // Cifrar contraseña
    const encryptedPassword = await cryptoService.encrypt(input.password);

    const now = Date.now();
    const account: Account = {
      id: `acc_${cryptoService.generateSecureId()}`,
      alias: input.alias,
      username: input.username,
      domain: input.domain,
      encryptedPassword,
      type: input.type,
      createdAt: now,
      updatedAt: now,
      lastUsed: null,
      ...(input.avatar ? { avatar: input.avatar } : {}),
    };

    existing.push(account);
    await this.persist(existing);

    // Auto-seleccionar si es la primera cuenta
    if (existing.length === 1) {
      await this.select(account.id);
    }

    return account;
  }

  async update(id: string, input: Partial<NewAccountInput>): Promise<Account> {
    if (cryptoService.isLocked()) {
      throw new Error('Crypto is locked — unlock first');
    }

    const accounts = await this.list();
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx === -1) throw new Error('Cuenta no encontrada');

    const current = accounts[idx]!;
    const updated: Account = {
      ...current,
      alias: input.alias ?? current.alias,
      username: input.username ?? current.username,
      domain: input.domain ?? current.domain,
      type: input.type ?? current.type,
      updatedAt: Date.now(),
    };

    // Si se cambió la contraseña, re-cifrar
    const newEncryptedPassword = input.password !== undefined
      ? await cryptoService.encrypt(input.password)
      : current.encryptedPassword;

    accounts[idx] = { ...updated, encryptedPassword: newEncryptedPassword };
    await this.persist(accounts);
    return updated;
  }

  async delete(id: string): Promise<void> {
    const accounts = await this.list();
    const filtered = accounts.filter((a) => a.id !== id);
    await this.persist(filtered);

    // Si era la seleccionada, limpiar
    if (this.selectedId === id) {
      this.selectedId = filtered.length > 0 ? filtered[0]!.id : null;
      const driver = getStorageDriver();
      if (this.selectedId) {
        await driver.setLocal(STORAGE_KEYS.ACCOUNTS_SELECTED, this.selectedId);
      } else {
        await driver.removeLocal(STORAGE_KEYS.ACCOUNTS_SELECTED);
      }
    }
  }

  async list(): Promise<Account[]> {
    if (this.cache) return this.cache;
    const driver = getStorageDriver();
    const stored = await driver.getLocal<Account[]>(STORAGE_KEYS.ACCOUNTS_LIST);
    this.cache = stored ?? [];
    return this.cache;
  }

  async getById(id: string): Promise<Account | null> {
    const accounts = await this.list();
    return accounts.find((a) => a.id === id) ?? null;
  }

  // —— Selección ————————————————————————————————————————————

  async select(id: string): Promise<void> {
    const accounts = await this.list();
    if (!accounts.some((a) => a.id === id)) {
      throw new Error('Cuenta no encontrada');
    }
    this.selectedId = id;
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.ACCOUNTS_SELECTED, id);
  }

  async getSelected(): Promise<Account | null> {
    if (!this.selectedId) {
      const driver = getStorageDriver();
      this.selectedId = await driver.getLocal<string>(STORAGE_KEYS.ACCOUNTS_SELECTED);
    }
    if (!this.selectedId) return null;
    return this.getById(this.selectedId);
  }

  // —— Utilidades ————————————————————————————————————————————

  async markUsed(id: string): Promise<void> {
    const accounts = await this.list();
    const idx = accounts.findIndex((a) => a.id === id);
    if (idx === -1) return;
    accounts[idx] = { ...accounts[idx]!, lastUsed: Date.now() };
    await this.persist(accounts);
  }

  async getDecryptedPassword(id: string): Promise<string> {
    if (cryptoService.isLocked()) {
      throw new Error('Crypto is locked');
    }
    const account = await this.getById(id);
    if (!account) throw new Error('Cuenta no encontrada');
    return cryptoService.decrypt(account.encryptedPassword);
  }

  getFullUsername(account: Account): string {
    return `${account.username}@${account.domain}`;
  }

  // —— Privados ————————————————————————————————————————————————

  private async persist(accounts: Account[]): Promise<void> {
    this.cache = accounts;
    const driver = getStorageDriver();
    await driver.setLocal(STORAGE_KEYS.ACCOUNTS_LIST, accounts);
  }
}

export const accountManager = new AccountManagerImpl();
