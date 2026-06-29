/**
 * NEXA NautaX — UI Store
 * Fase 2 — Doc 1 §7.2
 *
 * Estado efímero de UI: navegación, toasts, loading flags.
 * NO se persiste (se pierde al cerrar popup/sidepanel).
 */

import { create } from 'zustand';
import type { NotificationId } from '@/types/branded';

// —— Tipos ————————————————————————————————————————————————————

export type PopupView = 'unlock' | 'onboarding' | 'logged_out' | 'connecting' | 'connected' | 'offline' | 'error' | 'session_expired' | 'disconnected';

export type SidePanelView = 'dashboard' | 'accounts' | 'scheduler' | 'settings' | 'developer' | 'about';

export interface ToastNotification {
  readonly id: NotificationId;
  readonly variant: 'success' | 'error' | 'warning' | 'info';
  readonly title: string;
  readonly message?: string | undefined;
  readonly action?: { readonly label: string; readonly onClick: () => void } | undefined;
  readonly durationMs: number;
  readonly createdAt: number;
  readonly persistent?: boolean | undefined;
}

interface UiState {
  // —— Popup ————————————————————————————————————————————
  readonly popupView: PopupView;
  readonly popupLoading: boolean;

  // —— SidePanel ————————————————————————————————————————
  readonly sidePanelView: SidePanelView;

  // —— Toasts ——————————————————————————————————————————
  readonly toasts: readonly ToastNotification[];

  // —— Global ——————————————————————————————————————————
  readonly globalLoading: boolean;
}

interface UiActions {
  setPopupView: (view: PopupView) => void;
  setPopupLoading: (loading: boolean) => void;
  setSidePanelView: (view: SidePanelView) => void;
  setGlobalLoading: (loading: boolean) => void;

  // Toasts
  pushToast: (toast: Omit<ToastNotification, 'id' | 'createdAt'>) => NotificationId;
  dismissToast: (id: NotificationId) => void;
  dismissAllToasts: () => void;
}

type UiStore = UiState & UiActions;

// —— Implementación ————————————————————————————————————————————

export const useUiStore = create<UiStore>((set, get) => ({
  // State
  popupView: 'logged_out',
  popupLoading: false,
  sidePanelView: 'dashboard',
  toasts: [],
  globalLoading: false,

  // Actions
  setPopupView: (view) => set({ popupView: view }),
  setPopupLoading: (loading) => set({ popupLoading: loading }),
  setSidePanelView: (view) => set({ sidePanelView: view }),
  setGlobalLoading: (loading) => set({ globalLoading: loading }),

  pushToast: (toast) => {
    const id = `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 10)}` as NotificationId;
    const fullToast: ToastNotification = {
      ...toast,
      id,
      createdAt: Date.now(),
    };
    const currentToasts = get().toasts;
    // Máximo 3 visibles
    const trimmed = currentToasts.slice(-2);
    set({ toasts: [...trimmed, fullToast] });

    // Auto-dismiss si no es persistente
    if (!toast.persistent && toast.durationMs > 0) {
      setTimeout(() => {
        get().dismissToast(id);
      }, toast.durationMs);
    }

    return id;
  },

  dismissToast: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },

  dismissAllToasts: () => set({ toasts: [] }),
}));
