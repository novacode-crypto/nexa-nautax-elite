/**
 * NEXA NautaX — ToastProvider
 *
 * Expone el NexaToastContainer y un hook useToast para disparar toasts.
 */

import { type ReactNode } from 'react';
import { useUiStore } from '@/store/uiStore';
import { NexaToastContainer } from '@/components/nexa/NexaToastContainer';
import type { NotificationId } from '@/types/branded';

export interface ToastOptions {
  readonly title: string;
  readonly message?: string;
  readonly variant?: 'success' | 'error' | 'warning' | 'info';
  readonly durationMs?: number;
  readonly persistent?: boolean;
  readonly action?: { readonly label: string; readonly onClick: () => void };
}

export interface ToastApi {
  success: (title: string, message?: string | undefined) => NotificationId;
  error: (title: string, message?: string | undefined, persistent?: boolean | undefined) => NotificationId;
  warning: (title: string, message?: string | undefined) => NotificationId;
  info: (title: string, message?: string | undefined) => NotificationId;
  custom: (options: ToastOptions) => NotificationId;
  dismiss: (id: NotificationId) => void;
  dismissAll: () => void;
}

export interface ToastProviderProps {
  readonly children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const pushToast = useUiStore((s) => s.pushToast);
  const dismissToast = useUiStore((s) => s.dismissToast);
  const dismissAllToasts = useUiStore((s) => s.dismissAllToasts);

  const api: ToastApi = {
    success: (title, message) =>
      pushToast({ title, message, variant: 'success', durationMs: 5000 }),
    error: (title, message, persistent = false) =>
      pushToast({ title, message, variant: 'error', durationMs: persistent ? 0 : 8000, persistent }),
    warning: (title, message) =>
      pushToast({ title, message, variant: 'warning', durationMs: 8000 }),
    info: (title, message) =>
      pushToast({ title, message, variant: 'info', durationMs: 5000 }),
    custom: (options) =>
      pushToast({
        title: options.title,
        message: options.message,
        variant: options.variant ?? 'info',
        durationMs: options.durationMs ?? 5000,
        persistent: options.persistent,
        action: options.action,
      }),
    dismiss: (id) => dismissToast(id),
    dismissAll: () => dismissAllToasts(),
  };

  // Hacer la API disponible via window para debugging
  if (typeof window !== 'undefined') {
    (window as unknown as { __nexaToast?: ToastApi }).__nexaToast = api;
  }

  return (
    <>
      {children}
      <NexaToastContainer />
    </>
  );
}

// —— Hook de conveniencia ————————————————————————————————————————

export function useToast(): ToastApi {
  const pushToast = useUiStore((s) => s.pushToast);
  const dismissToast = useUiStore((s) => s.dismissToast);
  const dismissAllToasts = useUiStore((s) => s.dismissAllToasts);

  return {
    success: (title, message) =>
      pushToast({ title, message, variant: 'success', durationMs: 5000 }),
    error: (title, message, persistent = false) =>
      pushToast({ title, message, variant: 'error', durationMs: persistent ? 0 : 8000, persistent }),
    warning: (title, message) =>
      pushToast({ title, message, variant: 'warning', durationMs: 8000 }),
    info: (title, message) =>
      pushToast({ title, message, variant: 'info', durationMs: 5000 }),
    custom: (options) =>
      pushToast({
        title: options.title,
        message: options.message,
        variant: options.variant ?? 'info',
        durationMs: options.durationMs ?? 5000,
        persistent: options.persistent,
        action: options.action,
      }),
    dismiss: (id) => dismissToast(id),
    dismissAll: () => dismissAllToasts(),
  };
}
