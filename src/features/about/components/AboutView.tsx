/**
 * NEXA NautaX — About View — Premium edition
 *
 * Vista "Acerca de" vistosa y profesional con:
 *  - Hero con logo grande + glow
 *  - Versión + badge Elite
 *  - Descripción del producto
 *  - Cards de características (cifrado, local, privado, ETECSA)
 *  - Stack tecnológico
 *  - Enlaces (privacidad, licencia, soporte)
 *  - Créditos
 */

import { useEffect, useState } from 'react';
import {
  ShieldCheck,
  Zap,
  Lock,
  Globe,
  Heart,
  Code2,
  Github,
  FileText,
  Mail,
  Sparkles,
  ArrowUpRight,
} from 'lucide-react';
import { NexaCard } from '@/components/nexa/NexaCard';
import { NexaLogo } from '@/components/nexa/NexaLogo';
import { NexaBadge } from '@/components/nexa/NexaBadge';
import { StaggerItem } from '@/components/nexa/StaggerAnimation';
import { messageClient, type ExtensionMeta } from '@/modules/messaging/messageClient';

export function AboutView() {
  const [meta, setMeta] = useState<ExtensionMeta | null>(null);

  useEffect(() => {
    void (async () => {
      const r = await messageClient.metaGet();
      if (r.ok) setMeta(r.data);
    })();
  }, []);

  const version = meta?.extensionVersion ?? '1.0.0';
  const installedAt = meta?.installedAt
    ? new Date(meta.installedAt).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <div className="flex flex-col gap-5 min-w-0">
      {/* —— Hero —— */}
      <StaggerItem index={0}>
        <div
          className="relative overflow-hidden rounded-2xl flex flex-col items-center text-center py-8 px-6"
          style={{
            background: 'var(--background-gradient)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          {/* Decorative orbs */}
          <div
            aria-hidden="true"
            className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-30 pointer-events-none"
            style={{ background: 'var(--accent)', filter: 'blur(60px)' }}
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-16 -left-16 w-32 h-32 rounded-full opacity-20 pointer-events-none"
            style={{ background: 'var(--primary)', filter: 'blur(50px)' }}
          />

          {/* Logo con glow */}
          <div className="relative mb-4">
            <NexaLogo variant="icon" size="xl" glow className="h-24 w-24" />
          </div>

          {/* Nombre + Elite */}
          <div className="relative flex items-center gap-2 mb-2">
            <h1 className="text-display text-3xl font-bold tracking-tight">
              <span
                style={{
                  backgroundImage: 'var(--gradient-text-primary)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                NEXA
              </span>{' '}
              <span style={{ color: 'var(--foreground-muted)' }}>NautaX</span>
            </h1>
            <NexaBadge variant="primary" size="md">ELITE</NexaBadge>
          </div>

          <p className="relative text-sm text-foreground-muted max-w-xs mb-4">
            Administración premium de cuentas Nauta ETECSA con cifrado de grado militar.
          </p>

          {/* Versión */}
          <div className="relative flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1.5 text-foreground-muted">
              <Sparkles size={12} style={{ color: 'var(--accent)' }} />
              Versión <span className="font-mono text-foreground">{version}</span>
            </span>
            <span className="text-foreground-subtle">·</span>
            <span className="text-foreground-muted">Instalada el {installedAt}</span>
          </div>
        </div>
      </StaggerItem>

      {/* —— Características principales —— */}
      <StaggerItem index={1}>
        <div>
          <h2 className="text-display text-base font-semibold text-foreground mb-3">Características</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <FeatureCard
              Icon={ShieldCheck}
              title="Cifrado AES-256"
              description="Credenciales protegidas con PBKDF2 + AES-GCM"
              color="var(--success)"
            />
            <FeatureCard
              Icon={Lock}
              title="100% Local"
              description="Todo se guarda en tu navegador. Nada se envía a servidores."
              color="var(--accent)"
            />
            <FeatureCard
              Icon={Zap}
              title="Conexión rápida"
              description="Connector optimizado con 5 estrategias de scraping"
              color="var(--warning)"
            />
            <FeatureCard
              Icon={Globe}
              title="ETECSA real"
              description="Compatible con secure.etecsa.net:8443"
              color="var(--info)"
            />
          </div>
        </div>
      </StaggerItem>

      {/* —— Stack tecnológico —— */}
      <StaggerItem index={2}>
        <NexaCard padding="md" variant="outline">
          <div className="flex items-center gap-2 mb-3">
            <Code2 size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-display text-base font-semibold text-foreground">Stack tecnológico</h2>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[
              'TypeScript 5.5',
              'React 18',
              'Vite 5',
              'Tailwind CSS 3',
              'Zustand 4',
              'Manifest V3',
              'chrome.storage',
              'Web Crypto API',
              'lucide-react',
            ].map((tech) => (
              <span
                key={tech}
                className="text-[10px] px-2 py-1 rounded-md font-mono"
                style={{
                  backgroundColor: 'var(--muted)',
                  color: 'var(--foreground-muted)',
                  border: '1px solid var(--border)',
                }}
              >
                {tech}
              </span>
            ))}
          </div>
        </NexaCard>
      </StaggerItem>

      {/* —— Enlaces —— */}
      <StaggerItem index={3}>
        <NexaCard padding="md">
          <div className="flex items-center gap-2 mb-3">
            <FileText size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-display text-base font-semibold text-foreground">Enlaces</h2>
          </div>
          <div className="flex flex-col gap-1">
            <LinkRow Icon={FileText} label="Política de privacidad" hint="Cómo se manejan tus datos" href="https://github.com/tu-usuario/nexa-nautax-elite/blob/main/PRIVACY.md" />
            <LinkRow Icon={Github} label="Código fuente" hint="Repositorio en GitHub" href="https://github.com/tu-usuario/nexa-nautax-elite" />
            <LinkRow Icon={Mail} label="Soporte" hint="Reporta bugs o pide funciones" href="https://github.com/tu-usuario/nexa-nautax-elite/issues" />
          </div>
        </NexaCard>
      </StaggerItem>

      {/* —— Créditos —— */}
      <StaggerItem index={4}>
        <div
          className="flex flex-col items-center text-center py-5 px-4 rounded-xl"
          style={{
            background: 'var(--background-glass)',
            border: '1px solid var(--border-subtle)',
          }}
        >
          <p className="text-xs text-foreground-muted mb-1">Hecho con</p>
          <div className="flex items-center gap-1.5 mb-2">
            <Heart size={14} style={{ color: 'var(--error)' }} fill="currentColor" />
            <span className="text-sm font-medium text-foreground">para los usuarios Nauta de Cuba</span>
          </div>
          <p className="text-[10px] text-foreground-subtle font-mono">
            © 2024-2026 NEXA · NautaX ELITE
          </p>
          <p className="text-[10px] text-foreground-subtle mt-1">
            Ecosistema NEXA · Producto NautaX
          </p>
        </div>
      </StaggerItem>

      {/* —— Disclaimer —— */}
      <StaggerItem index={5}>
        <div
          className="p-3 rounded-lg text-xs text-foreground-muted leading-relaxed"
          style={{
            backgroundColor: 'rgba(245, 158, 11, 0.05)',
            border: '1px solid rgba(245, 158, 11, 0.15)',
          }}
        >
          <strong style={{ color: 'var(--warning)' }}>Nota:</strong> Esta extensión no está
          afiliada con ETECSA. Es una herramienta independiente para gestionar cuentas Nauta.
          Usa credenciales y conexiones del portal cautivo oficial.
        </div>
      </StaggerItem>
    </div>
  );
}

// —— Sub-componentes ————————————————————————————————————————————

function FeatureCard({
  Icon,
  title,
  description,
  color,
}: {
  readonly Icon: typeof ShieldCheck;
  readonly title: string;
  readonly description: string;
  readonly color: string;
}) {
  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-xl"
      style={{
        backgroundColor: 'var(--background-glass)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div
        className="flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0"
        style={{ backgroundColor: `${color}15`, color }}
      >
        <Icon size={18} />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-[10px] text-foreground-muted leading-snug mt-0.5">{description}</p>
      </div>
    </div>
  );
}

function LinkRow({
  Icon,
  label,
  hint,
  href,
}: {
  readonly Icon: typeof FileText;
  readonly label: string;
  readonly hint: string;
  readonly href: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 p-2.5 rounded-lg text-left transition-all w-full cursor-pointer"
      style={{ backgroundColor: 'transparent' }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = 'var(--accent-soft)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <Icon size={16} style={{ color: 'var(--accent)' }} className="flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground">{label}</p>
        <p className="text-[10px] text-foreground-muted">{hint}</p>
      </div>
      <ArrowUpRight size={14} className="flex-shrink-0 text-foreground-subtle" />
    </a>
  );
}
