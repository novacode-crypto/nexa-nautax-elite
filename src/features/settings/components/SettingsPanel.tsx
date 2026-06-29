/**
 * NEXA NautaX — Settings View (SidePanel) 
 *
 * Secciones:
 *  1. Apariencia (selector de tema)
 *  2. Notificaciones (todos los switches + alertas sonoras + umbral)
 *  3. Backup (exportar/importar JSON con checksum)
 *  4. Información de la extensión (versión, instalación ID, fecha, cuentas, sesiones, cifrado)
 *  5. Developer Mode (toggle)
 *  6. Zona peligrosa (borrar cuentas, resetear settings, factory reset)
 *
 * Nota: El cifrado AES-256 es transparente (sin contraseña maestra).
 * La clave se deriva automáticamente del installationId en CryptoService.
 */

import { useState, useEffect, useRef } from 'react';
import {
  Palette,
  Bell,
  Database,
  Eye,
  Info,
  AlertTriangle,
  Download,
  Upload,
  Trash2,
  RotateCcw,
  Power,
  ShieldCheck,
} from 'lucide-react';
import { NexaCard } from '@/components/nexa/NexaCard';
import { NexaSwitch } from '@/components/nexa/NexaSwitch';
import { NexaButton } from '@/components/nexa/NexaButton';
import { ThemeSelectorGrid } from '@/components/layout/ThemeToggle';
import { StaggerItem } from '@/components/nexa/StaggerAnimation';
import { useSettingsStore } from '@/store/settingsStore';
import { useToast } from '@/providers/ToastProvider';
import { messageClient, type ExtensionMeta } from '@/modules/messaging/messageClient';
import { DangerConfirmDialog } from './DangerConfirmDialog';

export function SettingsView() {
  const settings = useSettingsStore((s) => s.settings);
  const setDeveloperVisible = useSettingsStore((s) => s.setDeveloperVisible);
  const updateNotifications = useSettingsStore((s) => s.updateNotifications);
  const toast = useToast();

  const [meta, setMeta] = useState<ExtensionMeta | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshMeta = async () => {
    const r = await messageClient.metaGet();
    if (r.ok) setMeta(r.data);
  };

  useEffect(() => {
    void refreshMeta();
  }, []);

  // —— Backup export ——
  const handleBackupExport = async () => {
    const r = await messageClient.backupExport();
    if (!r.ok) {
      toast.error('Error al exportar', r.error.userMessage);
      return;
    }
    const json = JSON.stringify(r.data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nexa-nautax-backup-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Backup exportado', 'Se descargó el archivo JSON');
  };

  // —— Backup import ——
  const handleBackupImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleBackupImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!parsed.version || !parsed.data || !parsed.checksum) {
        toast.error('Archivo inválido', 'El archivo no parece ser un backup de NEXA NautaX');
        return;
      }
      const r = await messageClient.backupImport(parsed);
      if (r.ok) {
        toast.success('Backup importado', 'Recarga la extensión para ver los cambios');
      } else {
        toast.error('Error al importar', r.error.userMessage);
      }
    } catch {
      toast.error('Error al leer el archivo', 'Asegúrate de que sea un JSON válido');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // —— Danger zone ——
  const [dangerDialog, setDangerDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmWord: string;
    confirmLabel: string;
    action: () => Promise<void> | void;
  }>({
    open: false,
    title: '',
    message: '',
    confirmWord: '',
    confirmLabel: '',
    action: async () => {},
  });

  const closeDanger = () => setDangerDialog((d) => ({ ...d, open: false }));

  const handleClearAccounts = () => {
    setDangerDialog({
      open: true,
      title: 'Borrar todas las cuentas',
      message:
        'Se eliminarán todas tus cuentas Nauta guardadas (las contraseñas cifradas, los alias y los dominios). Esta acción no se puede deshacer. La sesión activa, los settings y el historial se conservan.',
      confirmWord: 'BORRAR',
      confirmLabel: 'Borrar cuentas',
      action: async () => {
        const r = await messageClient.dangerClearAccounts();
        if (r.ok) {
          toast.success('Cuentas borradas', 'Todas las cuentas fueron eliminadas');
          void refreshMeta();
        } else {
          toast.error('Error', r.error.userMessage);
        }
      },
    });
  };

  const handleResetSettings = () => {
    setDangerDialog({
      open: true,
      title: 'Resetear configuración',
      message:
        'Se restaurarán todos los ajustes a sus valores por defecto (tema, notificaciones). Las cuentas y el historial no se modifican.',
      confirmWord: 'RESET',
      confirmLabel: 'Resetear ajustes',
      action: async () => {
        const r = await messageClient.dangerResetSettings();
        if (r.ok) {
          toast.success('Configuración reseteada', 'Recarga la extensión para aplicar los cambios');
        } else {
          toast.error('Error', r.error.userMessage);
        }
      },
    });
  };

  const handleFactoryReset = () => {
    setDangerDialog({
      open: true,
      title: 'Factory reset',
      message:
        'SE BORRARÁ TODO: cuentas, sesión, historial, ajustes y cifrado. La extensión quedá como recién instalada. No hay recuperación posible.',
      confirmWord: 'FACTORY',
      confirmLabel: 'Borrar todo',
      action: async () => {
        const r = await messageClient.dangerFactoryReset();
        if (r.ok) {
          toast.success('Factory reset completo', 'Recargando extensión...');
          setTimeout(() => chrome.runtime.reload(), 1500);
        } else {
          toast.error('Error', r.error.userMessage);
        }
      },
    });
  };

  return (
    <div className="flex flex-col gap-5 min-w-0">
      <StaggerItem index={0}>
        <div>
          <h1 className="text-display text-2xl font-bold tracking-tight mb-1">Configuración</h1>
          <p className="text-sm text-foreground-muted">Personaliza NEXA NautaX ELITE.</p>
        </div>
      </StaggerItem>

      {/* 1. Apariencia */}
      <StaggerItem index={1}>
        <NexaCard padding="md">
          <SectionHeader Icon={Palette} title="Apariencia" />
          <p className="text-xs text-foreground-muted mb-3">Elige el tema de la interfaz.</p>
          <ThemeSelectorGrid />
        </NexaCard>
      </StaggerItem>

      {/* 2. Notificaciones */}
      <StaggerItem index={2}>
        <NexaCard padding="md">
          <SectionHeader Icon={Bell} title="Notificaciones" />
          <NexaSwitch
            checked={settings.notifications.enabled}
            onChange={(checked) => {
              void updateNotifications({ enabled: checked });
              toast.success(checked ? 'Notificaciones activadas' : 'Notificaciones desactivadas');
            }}
            label="Notificaciones activadas"
            description="Mostrar toasts y cambiar el icono en eventos."
          />
          <NexaSwitch
            checked={settings.notifications.soundAlerts}
            onChange={(checked) => {
              void updateNotifications({ soundAlerts: checked });
              toast.success(checked ? 'Alertas sonoras: activadas' : 'Alertas sonoras: desactivadas');
            }}
            label="Alertas sonoras"
            description="Reproducir un beep al recibir notificaciones (requiere offscreen)."
          />
          <NexaSwitch
            checked={settings.notifications.onDisconnect}
            onChange={(checked) => {
              void updateNotifications({ onDisconnect: checked });
              toast.success(checked ? 'Aviso de desconexión: activado' : 'Aviso de desconexión: desactivado');
            }}
            label="Al desconectarse"
            description="Notificar cuando se pierde la conexión ETECSA."
          />
          <NexaSwitch
            checked={settings.notifications.onLowBalance}
            onChange={(checked) => {
              void updateNotifications({ onLowBalance: checked });
              toast.success(checked ? 'Saldo bajo: activado' : 'Saldo bajo: desactivado');
            }}
            label={`Saldo bajo (umbral: ${settings.notifications.lowBalanceThreshold} CUP)`}
            description="Avisar cuando el saldo sea menor al umbral."
          />
          <NexaSwitch
            checked={settings.notifications.onLowTime}
            onChange={(checked) => {
              void updateNotifications({ onLowTime: checked });
              toast.success(checked ? 'Tiempo bajo: activado' : 'Tiempo bajo: desactivado');
            }}
            label={`Tiempo bajo (umbral: ${settings.notifications.lowTimeThresholdMinutes} min)`}
            description="Avisar cuando quede poco tiempo de sesión."
          />
          <NexaSwitch
            checked={settings.notifications.onConnectorError}
            onChange={(checked) => {
              void updateNotifications({ onConnectorError: checked });
              toast.success(checked ? 'Errores del connector: activado' : 'Errores del connector: desactivado');
            }}
            label="Errores del connector"
            description="Notificar problemas con ETECSA."
          />
          <div className="py-2">
            <p className="text-sm text-foreground mb-2">Nivel de detalle (verbosity)</p>
            <div className="flex gap-2">
              {(['minimal', 'normal', 'detailed'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => {
                    void updateNotifications({ verbosity: v });
                    toast.info(`Verbosidad: ${v}`);
                  }}
                  className="flex-1 text-xs px-3 py-2 rounded-lg border transition-colors"
                  style={{
                    borderColor: settings.notifications.verbosity === v ? 'var(--accent)' : 'var(--border)',
                    backgroundColor: settings.notifications.verbosity === v ? 'var(--accent-soft)' : 'transparent',
                    color: settings.notifications.verbosity === v ? 'var(--accent)' : 'var(--foreground-muted)',
                  }}
                >
                  {v === 'minimal' ? 'Mínimo' : v === 'normal' ? 'Normal' : 'Detallado'}
                </button>
              ))}
            </div>
          </div>
        </NexaCard>
      </StaggerItem>

      {/* 3. Backup */}
      <StaggerItem index={3}>
        <NexaCard padding="md">
          <SectionHeader Icon={Database} title="Backup" />
          <p className="text-xs text-foreground-muted mb-3">
            Exporta todas tus cuentas, ajustes e historial en un archivo JSON.
            El backup incluye un checksum SHA-256 para detectar alteraciones.
          </p>
          <div className="flex flex-col gap-2">
            <NexaButton
              variant="secondary"
              size="sm"
              fullWidth
              onClick={handleBackupExport}
              icon={<Download size={14} />}
            >
              Exportar backup
            </NexaButton>
            <NexaButton
              variant="secondary"
              size="sm"
              fullWidth
              onClick={handleBackupImportClick}
              icon={<Upload size={14} />}
            >
              Importar backup
            </NexaButton>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json,.json"
              onChange={handleBackupImportFile}
              className="hidden"
            />
          </div>
        </NexaCard>
      </StaggerItem>

      {/* 4. Información de la extensión */}
      <StaggerItem index={4}>
        <NexaCard padding="md" variant="outline">
          <SectionHeader Icon={Info} title="Información de la extensión" />
          <div className="space-y-1.5 text-xs font-mono">
            <InfoRow label="Versión" value={meta?.extensionVersion ?? '—'} />
            <InfoRow label="Installation ID" value={meta?.installationId ?? '—'} mono />
            <InfoRow
              label="Instalada el"
              value={meta?.installedAt ? new Date(meta.installedAt).toLocaleString('es-ES') : '—'}
            />
            <InfoRow
              label="Último inicio"
              value={meta?.lastStartup ? new Date(meta.lastStartup).toLocaleString('es-ES') : '—'}
            />
            <InfoRow label="Cuentas guardadas" value={String(meta?.accountsCount ?? '—')} />
            <InfoRow label="Sesiones en historial" value={String(meta?.historyCount ?? '—')} />
            <div className="flex items-center justify-between gap-3 pt-1.5 mt-1.5 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-foreground-muted flex items-center gap-1.5">
                <ShieldCheck size={12} style={{ color: 'var(--success)' }} />
                Cifrado:
              </span>
              <span style={{ color: 'var(--success)' }}>AES-256 activo</span>
            </div>
          </div>
        </NexaCard>
      </StaggerItem>

      {/* 5. Developer mode */}
      <StaggerItem index={5}>
        <NexaCard padding="md">
          <SectionHeader Icon={Eye} title="Developer Mode" />
          <NexaSwitch
            checked={settings.developer.visible}
            onChange={(checked) => {
              void setDeveloperVisible(checked);
              toast.success(checked ? 'Developer Mode activado' : 'Developer Mode desactivado');
            }}
            label="Mostrar Developer Mode"
            description="Habilita la pestaña de diagnóstico en el panel lateral. Activa el modo demo desde ahí."
          />
        </NexaCard>
      </StaggerItem>

      {/* 6. Zona peligrosa */}
      <StaggerItem index={6}>
        <NexaCard padding="md" variant="solid">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={18} style={{ color: 'var(--error)' }} />
            <h2 className="text-display text-base font-semibold text-foreground">Zona peligrosa</h2>
          </div>
          <p className="text-xs text-foreground-muted mb-3">
            Estas acciones son irreversibles. Procede con cuidado.
          </p>
          <div className="flex flex-col gap-2">
            <DangerButton
              Icon={Trash2}
              label="Borrar todas las cuentas"
              description="Elimina las cuentas Nauta guardadas (mantiene settings e historial)."
              onClick={handleClearAccounts}
            />
            <DangerButton
              Icon={RotateCcw}
              label="Resetear configuración"
              description="Restaura los ajustes a sus valores por defecto."
              onClick={handleResetSettings}
            />
            <DangerButton
              Icon={Power}
              label="Factory reset"
              description="Borra TODO: cuentas, sesión, historial, settings y cifrado. Recarga la extensión."
              onClick={handleFactoryReset}
              danger
            />
          </div>
        </NexaCard>
      </StaggerItem>

      {/* Dialogs */}
      <DangerConfirmDialog
        open={dangerDialog.open}
        onClose={closeDanger}
        title={dangerDialog.title}
        message={dangerDialog.message}
        confirmWord={dangerDialog.confirmWord}
        confirmLabel={dangerDialog.confirmLabel}
        onConfirm={dangerDialog.action}
      />
    </div>
  );
}

// —— Sub-componentes ————————————————————————————————————————————

function SectionHeader({ Icon, title }: { readonly Icon: typeof Palette; readonly title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon size={18} style={{ color: 'var(--accent)' }} />
      <h2 className="text-display text-base font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function InfoRow({ label, value, mono }: { readonly label: string; readonly value: string; readonly mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-foreground-muted">{label}:</span>
      <span
        className="text-foreground"
        style={mono ? { maxWidth: '60%', overflow: 'hidden', textOverflow: 'ellipsis' } : undefined}
        title={mono ? value : undefined}
      >
        {value}
      </span>
    </div>
  );
}

function DangerButton({
  Icon,
  label,
  description,
  onClick,
  danger = false,
}: {
  readonly Icon: typeof Trash2;
  readonly label: string;
  readonly description: string;
  readonly onClick: () => void;
  readonly danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-start gap-3 p-3 rounded-lg border text-left transition-all w-full"
      style={{
        borderColor: danger ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)',
        backgroundColor: 'transparent',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = danger ? 'var(--error)' : 'var(--accent)';
        e.currentTarget.style.backgroundColor = danger ? 'rgba(239, 68, 68, 0.05)' : 'var(--accent-soft)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = danger ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)';
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <Icon size={16} className="flex-shrink-0 mt-0.5" style={{ color: danger ? 'var(--error)' : 'var(--foreground-muted)' }} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: danger ? 'var(--error)' : 'var(--foreground)' }}>
          {label}
        </p>
        <p className="text-xs text-foreground-muted mt-0.5">{description}</p>
      </div>
    </button>
  );
}
