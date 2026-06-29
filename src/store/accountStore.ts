/**
 * NEXA NautaX — Account Store 
 *
 * Carga cuentas reales desde el SW via messageClient.
 * CRUD: create, update, remove, select.
 */

import { create } from 'zustand';
import { messageClient, type AccountSummary } from '@/modules/messaging/messageClient';

interface AccountState {
  readonly accounts: readonly AccountSummary[];
  readonly selectedId: string | null;
  readonly hydrated: boolean;
  readonly loading: boolean;
}

interface AccountActions {
  hydrate: () => Promise<void>;
  refresh: () => Promise<void>;
  create: (input: {
    alias: string;
    username: string;
    domain: 'nauta.com.cu' | 'nauta.co.cu';
    password: string;
    avatar?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  update: (id: string, input: {
    alias?: string;
    username?: string;
    domain?: 'nauta.com.cu' | 'nauta.co.cu';
    password?: string;
    avatar?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  remove: (id: string) => Promise<void>;
  select: (id: string) => Promise<void>;
}

type AccountStore = AccountState & AccountActions;

export const useAccountStore = create<AccountStore>((set, get) => ({
  accounts: [],
  selectedId: null,
  hydrated: false,
  loading: false,

  hydrate: async () => {
    await get().refresh();
    set({ hydrated: true });
  },

  refresh: async () => {
    const result = await messageClient.accountList();
    if (result.ok) {
      const accounts = result.data;
      // Mantener selectedId si sigue existiendo, sino auto-seleccionar primera
      const currentSelected = get().selectedId;
      const selectedId = currentSelected && accounts.some((a) => a.id === currentSelected)
        ? currentSelected
        : accounts.length > 0 ? accounts[0]!.id : null;
      set({ accounts, selectedId });
    }
  },

  create: async (input) => {
    set({ loading: true });
    const result = await messageClient.accountCreate({
      ...input,
      type: 'prepaid',
    });
    set({ loading: false });
    if (result.ok) {
      await get().refresh();
      return { success: true };
    }
    return { success: false, error: result.error.userMessage };
  },

  update: async (id, input) => {
    set({ loading: true });
    const result = await messageClient.accountUpdate(id, {
      ...input,
      type: 'prepaid',
    });
    set({ loading: false });
    if (result.ok) {
      await get().refresh();
      return { success: true };
    }
    return { success: false, error: result.error.userMessage };
  },

  remove: async (id) => {
    await messageClient.accountDelete(id);
    await get().refresh();
  },

  select: async (id) => {
    await messageClient.accountSelect(id);
    set({ selectedId: id });
  },
}));
