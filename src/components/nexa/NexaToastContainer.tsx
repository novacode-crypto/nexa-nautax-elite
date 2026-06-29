/**
 * NEXA NautaX — NexaToastContainer
 *  — Doc 3 §2.6
 *
 * Container fijo top-right que muestra toasts activos.
 * Se suscribe al uiStore.
 */

import { useUiStore } from '@/store/uiStore';
import type { NotificationId } from '@/types/branded';
import { NexaToast } from './NexaToast';

export function NexaToastContainer() {
  const toasts = useUiStore((s) => s.toasts);
  const dismissToast = useUiStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-3 right-3 z-[1500] flex flex-col gap-2 pointer-events-none"
      aria-live="polite"
      aria-atomic="true"
    >
      {toasts.map((toast) => (
        <NexaToast key={toast.id} toast={toast} onDismiss={(id) => dismissToast(id as NotificationId)} />
      ))}
    </div>
  );
}
