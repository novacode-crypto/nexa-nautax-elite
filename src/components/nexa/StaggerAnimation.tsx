/**
 * NEXA NautaX — Stagger animation utilities
 *
 * Efecto "lazy loading" premium: los elementos aparecen secuencialmente
 * con un fade-in + slide-up suave, escalonados.
 *
 * Uso:
 *   <div className="stagger-container">
 *     <div className="stagger-item">Elemento 1</div>
 *     <div className="stagger-item">Elemento 2</div>
 *     <div className="stagger-item">Elemento 3</div>
 *   </div>
 *
 * O con delay manual:
 *   <div className="animate-lazy-in" style={{ animationDelay: '60ms' }}>...</div>
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/utils/cn';

// —— Hook: detecta cuando un elemento entra en viewport ————————————

export function useInView<T extends HTMLElement = HTMLDivElement>(
  options: IntersectionObserverInit = { threshold: 0.1 },
): { readonly ref: React.RefObject<T>; readonly inView: boolean } {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        setInView(true);
        observer.unobserve(entry.target);
      }
    }, options);

    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { ref, inView };
}

// —— Componente StaggerContainer ————————————————————————————

export interface StaggerContainerProps {
  readonly children: ReactNode;
  readonly className?: string;
  readonly delay?: number; // delay entre items en ms (default 60)
  readonly initialDelay?: number; // delay inicial en ms (default 0)
}

/**
 * Contenedor que aplica stagger animation a sus hijos directos.
 * Cada hijo aparece con fade-in + slide-up, escalonado.
 */
export function StaggerContainer({
  children,
  className,
  delay = 80,
  initialDelay = 50,
}: StaggerContainerProps) {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <div
      ref={ref}
      className={cn(className)}
      style={{
        opacity: inView ? 1 : 0,
        transition: 'opacity 200ms ease-out',
      }}
    >
      {inView && (
        <>
          {Array.isArray(children)
            ? children.map((child, i) => (
                <div
                  key={i}
                  className="animate-lazy-in"
                  style={{ animationDelay: `${initialDelay + i * delay}ms` }}
                >
                  {child}
                </div>
              ))
            : <div className="animate-lazy-in">{children}</div>}
        </>
      )}
    </div>
  );
}

// —— Componente StaggerItem (manual) ————————————————————————————

export interface StaggerItemProps {
  readonly children: ReactNode;
  readonly index: number;
  readonly delay?: number;
  readonly initialDelay?: number;
  readonly className?: string;
}

export function StaggerItem({
  children,
  index,
  delay = 80,
  initialDelay = 50,
  className,
}: StaggerItemProps) {
  return (
    <div
      className={cn('animate-lazy-in', className)}
      style={{ animationDelay: `${initialDelay + index * delay}ms` }}
    >
      {children}
    </div>
  );
}
