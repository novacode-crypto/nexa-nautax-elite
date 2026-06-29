/**
 * NEXA NautaX — Crypto Store — v4
 * Auto-unlock en modo conveniente.
 */

import { create } from 'zustand';
import { messageClient } from '@/modules/messaging/messageClient';

interface CryptoState {
  readonly initialized: boolean;
  readonly locked: boolean;
  readonly createdAt: number | null;
  readonly hydrated: boolean;
  readonly loading: boolean;
  readonly error: string | null;
}

interface CryptoActions {
  hydrate: () => Promise<void>;
  createMaster: (password: string) => Promise<boolean>;
  unlock: (password: string) => Promise<boolean>;
  lock: () => Promise<void>;
}

type CryptoStore = CryptoState & CryptoActions;

export const useCryptoStore = create<CryptoStore>((set) => ({
  initialized: false,
  locked: true,
  createdAt: null,
  hydrated: false,
  loading: false,
  error: null,

  hydrate: async () => {
    const result = await messageClient.cryptoGetState();
    if (result.ok) {
      const state = result.data;
      set({ initialized: state.initialized, locked: state.locked, createdAt: state.createdAt, hydrated: true, error: null });
      if (state.initialized && state.locked) {
        const unlockResult = await messageClient.cryptoUnlock('');
        if (unlockResult.ok) set({ locked: false });
      }
    } else {
      set({ hydrated: true, error: result.error.userMessage });
    }
  },

  createMaster: async (password) => {
    set({ loading: true, error: null });
    const result = await messageClient.cryptoCreateMaster(password);
    if (result.ok) {
      set({ initialized: true, locked: false, loading: false, createdAt: Date.now() });
      return true;
    }
    set({ loading: false, error: result.error.userMessage });
    return false;
  },

  unlock: async (password) => {
    set({ loading: true, error: null });
    const result = await messageClient.cryptoUnlock(password);
    if (result.ok) {
      set({ locked: false, loading: false, error: null });
      return true;
    }
    set({ loading: false, error: result.error.userMessage });
    return false;
  },

  lock: async () => {
    await messageClient.cryptoLock();
    set({ locked: true });
  },
}));
