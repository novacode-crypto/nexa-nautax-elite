/**
 * NEXA NautaX — DropdownPortal
 *
 * Renderiza un dropdown en document.body via portal.
 * Calcula posición del trigger con getBoundingClientRect.
 * Evita TODOS los problemas de overflow/z-index.
 */

import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

export interface DropdownPortalProps {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly triggerRef: React.RefObject<HTMLElement | null>;
  readonly children: ReactNode;
  readonly align?: 'left' | 'right';
  readonly width?: number | string;
  readonly offsetY?: number;
}

export function DropdownPortal({
  open,
  onClose,
  triggerRef,
  children,
  align = 'left',
  width = 'auto',
  offsetY = 4,
}: DropdownPortalProps) {
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setPosition(null);
      return;
    }

    const update = () => {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const dropdownWidth = typeof width === 'number' ? width : rect.width;

      let left: number;
      if (align === 'right') {
        left = rect.right - dropdownWidth;
      } else {
        left = rect.left;
      }

      // Ajustar si se sale de la viewport
      if (left < 8) left = 8;
      if (left + dropdownWidth > window.innerWidth - 8) {
        left = window.innerWidth - 8 - dropdownWidth;
      }

      setPosition({
        top: rect.bottom + offsetY,
        left,
      });
    };

    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, triggerRef, align, width, offsetY]);

  // Cerrar al click fuera
  useEffect(() => {
    if (!open) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose, triggerRef]);

  if (!open || !position) return null;

  const computedWidth = typeof width === 'number' ? `${width}px` : `${triggerRef.current?.getBoundingClientRect().width ?? 200}px`;

  const dropdownStyle: React.CSSProperties = {
    position: 'fixed',
    top: `${position.top}px`,
    left: `${position.left}px`,
    width: computedWidth,
    zIndex: 99999,
    backgroundColor: 'var(--bg-elevated-3)',
    border: '1px solid var(--border-strong)',
    borderRadius: '8px',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
    maxHeight: '18rem',
    overflowY: 'auto',
  };

  return createPortal(
    <div ref={dropdownRef} style={dropdownStyle}>
      {children}
    </div>,
    document.body,
  );
}
