/**
 * NEXA NautaX — NexaPasswordInput — Premium edition
 * Fase 3 — Doc 3 §2.12
 *
 * Hereda el glow effect del NexaInput.
 */

import { forwardRef, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { NexaInput, type NexaInputProps } from './NexaInput';

export interface NexaPasswordInputProps extends Omit<NexaInputProps, 'type' | 'rightSlot'> {
  readonly showStrength?: boolean;
  readonly strength?: 'weak' | 'medium' | 'strong' | 'very-strong';
}

const STRENGTH_CONFIG = {
  weak: { label: 'Débil', segments: 1, color: 'var(--error)' },
  medium: { label: 'Media', segments: 2, color: 'var(--warning)' },
  strong: { label: 'Fuerte', segments: 3, color: 'var(--success)' },
  'very-strong': { label: 'Muy fuerte', segments: 4, color: 'var(--success)' },
} as const;

export const NexaPasswordInput = forwardRef<HTMLInputElement, NexaPasswordInputProps>(
  function NexaPasswordInput({ showStrength = false, strength, ...props }, ref) {
    const [show, setShow] = useState(false);

    const toggle = (
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="hover:text-accent transition-colors p-1"
        aria-label={show ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        tabIndex={-1}
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    );

    return (
      <div>
        <NexaInput ref={ref} type={show ? 'text' : 'password'} rightSlot={toggle} {...props} />

        {showStrength && strength && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex gap-1 flex-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="h-1 flex-1 rounded-full transition-all"
                  style={{
                    backgroundColor:
                      i <= STRENGTH_CONFIG[strength].segments
                        ? STRENGTH_CONFIG[strength].color
                        : 'var(--border)',
                  }}
                />
              ))}
            </div>
            <span
              className="text-xs font-medium"
              style={{ color: STRENGTH_CONFIG[strength].color }}
            >
              {STRENGTH_CONFIG[strength].label}
            </span>
          </div>
        )}
      </div>
    );
  },
);
