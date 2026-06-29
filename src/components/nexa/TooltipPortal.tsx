/**
 * NEXA NautaX — TooltipPortal
 *
 * Tooltip renderizado en document.body via portal.
 * Calcula posición con getBoundingClientRect.
 * NUNCA se corta, NUNCA queda debajo de otros elementos.
 *
 * Uso:
 *   <button
 *     ref={triggerRef}
 *     onMouseEnter={() => setShow(true)}
 *     onMouseLeave={() => setShow(false)}
 *   >
 *     <TooltipPortal show={show} triggerRef={triggerRef} position="bottom">
 *       Texto del tooltip
 *     </TooltipPortal>
 *   </button>
 *
 * O más simple, usar el hook useTooltip:
 *   const tooltip = useTooltip({ text: 'Hola', position: 'bottom' });
 *   <button ref={tooltip.ref} {...tooltip.handlers}>...</button>
 */

import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

export type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

export interface TooltipPortalProps {
  readonly show: boolean;
  readonly triggerRef: React.RefObject<HTMLElement | null>;
  readonly children: ReactNode;
  readonly position?: TooltipPosition;
  readonly offset?: number;
}

const TOOLTIP_PADDING_X = 8;
const TOOLTIP_PADDING_Y = 6;
const VIEWPORT_MARGIN = 8;

export function TooltipPortal({
  show,
  triggerRef,
  children,
  position = 'top',
  offset = 6,
}: TooltipPortalProps) {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!show || !triggerRef.current) {
      setCoords(null);
      return;
    }

    const update = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;

      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = triggerRect.top - tooltipRect.height - offset;
          left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          break;
        case 'bottom':
          top = triggerRect.bottom + offset;
          left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          break;
        case 'left':
          top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.left - tooltipRect.width - offset;
          break;
        case 'right':
          top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.right + offset;
          break;
      }

      // Clamp dentro del viewport
      if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
      if (left + tooltipRect.width > vw - VIEWPORT_MARGIN) {
        left = vw - VIEWPORT_MARGIN - tooltipRect.width;
      }
      if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN;
      if (top + tooltipRect.height > vh - VIEWPORT_MARGIN) {
        top = vh - VIEWPORT_MARGIN - tooltipRect.height;
      }

      setCoords({ top, left });
    };

    // Doble requestAnimationFrame para que el tooltip ya tenga tamaño medido
    requestAnimationFrame(() => {
      requestAnimationFrame(update);
    });
  }, [show, triggerRef, position, offset]);

  // Re-posicionar en scroll/resize
  useEffect(() => {
    if (!show) return;
    const update = () => {
      const trigger = triggerRef.current;
      const tooltip = tooltipRef.current;
      if (!trigger || !tooltip) return;

      const triggerRect = trigger.getBoundingClientRect();
      const tooltipRect = tooltip.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      let top = 0;
      let left = 0;

      switch (position) {
        case 'top':
          top = triggerRect.top - tooltipRect.height - offset;
          left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          break;
        case 'bottom':
          top = triggerRect.bottom + offset;
          left = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
          break;
        case 'left':
          top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.left - tooltipRect.width - offset;
          break;
        case 'right':
          top = triggerRect.top + triggerRect.height / 2 - tooltipRect.height / 2;
          left = triggerRect.right + offset;
          break;
      }

      if (left < VIEWPORT_MARGIN) left = VIEWPORT_MARGIN;
      if (left + tooltipRect.width > vw - VIEWPORT_MARGIN) {
        left = vw - VIEWPORT_MARGIN - tooltipRect.width;
      }
      if (top < VIEWPORT_MARGIN) top = VIEWPORT_MARGIN;
      if (top + tooltipRect.height > vh - VIEWPORT_MARGIN) {
        top = vh - VIEWPORT_MARGIN - tooltipRect.height;
      }

      setCoords({ top, left });
    };

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [show, triggerRef, position, offset]);

  if (!show) return null;

  const tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    top: coords ? `${coords.top}px` : '-9999px',
    left: coords ? `${coords.left}px` : '-9999px',
    zIndex: 100000,
    backgroundColor: 'var(--accent)',
    color: 'var(--accent-foreground)',
    padding: `${TOOLTIP_PADDING_Y}px ${TOOLTIP_PADDING_X}px`,
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    fontFamily: "'DNSans', system-ui, sans-serif",
    whiteSpace: 'nowrap',
    maxWidth: '240px',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    boxShadow: 'var(--shadow-md), var(--glow-accent)',
    letterSpacing: '0.01em',
    pointerEvents: 'none',
    opacity: coords ? 1 : 0,
    transition: 'opacity 120ms ease-out',
  };

  return createPortal(
    <div ref={tooltipRef} style={tooltipStyle} role="tooltip">
      {children}
    </div>,
    document.body,
  );
}

// —— Hook de conveniencia ————————————————————————————————

export interface UseTooltipOptions {
  readonly text: string;
  readonly position?: TooltipPosition;
}

export interface UseTooltipReturn {
  readonly ref: React.RefObject<HTMLElement | null>;
  readonly show: boolean;
  readonly handlers: {
    readonly onMouseEnter: () => void;
    readonly onMouseLeave: () => void;
    readonly onFocus: () => void;
    readonly onBlur: () => void;
  };
  readonly tooltip: ReactNode;
}

export function useTooltip({ text, position = 'top' }: UseTooltipOptions): UseTooltipReturn {
  const ref = useRef<HTMLElement>(null);
  const [show, setShow] = useState(false);

  return {
    ref: ref as React.RefObject<HTMLElement | null>,
    show,
    handlers: {
      onMouseEnter: () => setShow(true),
      onMouseLeave: () => setShow(false),
      onFocus: () => setShow(true),
      onBlur: () => setShow(false),
    },
    tooltip: (
      <TooltipPortal show={show} triggerRef={ref as React.RefObject<HTMLElement | null>} position={position}>
        {text}
      </TooltipPortal>
    ),
  };
}
