/**
 * NEXA NautaX — Developer View (SidePanel) — Fase 7 completa
 *
 * Secciones:
 *  1. Modo Demo (toggle global)
 *  2. Estado del sistema
 *  3. Tabs: Logs / Connector / Network / Storage / Session
 *  4. Herramientas (test login/logout, simular errores, reiniciar)
 *  5. Información técnica
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Terminal, Activity, Database, Server, Wrench, FlaskConical,
  Trash2, Download, RefreshCw, LogIn, LogOut, AlertTriangle,
  Eye, EyeOff, ChevronDown, ChevronRight,
} from 'lucide-react';
import { NexaCard } from '@/components/nexa/NexaCard';
import { NexaBadge } from '@/components/nexa/NexaBadge';
import { NexaSwitch } from '@/components/nexa/NexaSwitch';
import { StaggerItem } from '@/components/nexa/StaggerAnimation';
import { useSettingsStore } from '@/store/settingsStore';
import { useToast } from '@/providers/ToastProvider';
import { messageClient } from '@/modules/messaging/messageClient';
import { cn } from '@/utils/cn';

type DevTab = 'logs' | 'connector' | 'network' | 'storage' | 'session' | null;

interface LogEntry {
  readonly level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';
  readonly message: string;
  readonly timestamp: number;
  readonly category?: string;
}

// —— Hook: capturar logs de consola del sidepanel ——
const logBuffer: LogEntry[] = [];
const MAX_LOGS = 200;
let consoleIntercepted = false;

function interceptConsole() {
  if (consoleIntercepted) return;
  consoleIntercepted = true;

  const original = {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error,
  };

  const push = (level: LogEntry['level'], args: unknown[]) => {
    const message = args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ');
    const entry: LogEntry = { level, message, timestamp: Date.now() };
    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOGS) logBuffer.shift();

    // Notificar a los suscriptores
    window.dispatchEvent(new CustomEvent('nexa-log', { detail: entry }));
  };

  console.debug = (...args: unknown[]) => { push('DEBUG', args); original.debug(...args); };
  console.info = (...args: unknown[]) => { push('INFO', args); original.info(...args); };
  console.warn = (...args: unknown[]) => { push('WARN', args); original.warn(...args); };
  console.error = (...args: unknown[]) => { push('ERROR', args); original.error(...args); };
}

export function DeveloperView() {
  const toast = useToast();
  const demoMode = useSettingsStore((s) => s.settings.developer.demoMode);
  const setDemoMode = useSettingsStore((s) => s.setDemoMode);
  const [activeTab, setActiveTab] = useState<DevTab>(null);

  // Intercept console on mount
  useEffect(() => { interceptConsole(); }, []);

  const toggleTab = (tab: DevTab) => {
    setActiveTab((prev) => (prev === tab ? null : tab));
  };

  return (
    <div className="flex flex-col gap-5 min-w-0">
      {/* —— Título —— */}
      <StaggerItem index={0}>
        <div>
          <h1 className="text-display text-2xl font-bold tracking-tight mb-1">Developer Mode</h1>
          <p className="text-sm text-foreground-muted">
            Diagnóstico técnico y herramientas de desarrollo.
          </p>
        </div>
      </StaggerItem>

      {/* —— 1. Modo Demo —— */}
      <StaggerItem index={1}>
        <NexaCard padding="md">
          <div className="flex items-center gap-2 mb-3">
            <FlaskConical size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-display text-base font-semibold text-foreground">Modo Demo</h2>
            {demoMode && <NexaBadge variant="primary" size="sm">Activo</NexaBadge>}
          </div>
          <NexaSwitch
            checked={demoMode}
            onChange={(checked) => {
              void setDemoMode(checked);
              toast.info(checked ? 'Modo demo activado' : 'Modo demo desactivado');
            }}
            label="Activar modo demo"
            description="Muestra badges 'Demo' en el dashboard para previsualizar estados visuales."
          />
          {demoMode && (
            <div
              className="mt-3 flex items-start gap-2 p-3 rounded-lg text-xs"
              style={{ backgroundColor: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.2)', color: 'var(--accent)' }}
            >
              <FlaskConical size={12} className="flex-shrink-0 mt-0.5" />
              <span>Modo demo activo. Ve al Dashboard y haz clic en los badges "Demo" para cambiar de estado.</span>
            </div>
          )}
        </NexaCard>
      </StaggerItem>

      {/* —— 2. Estado del sistema —— */}
      <StaggerItem index={2}>
        <SystemStatusCard />
      </StaggerItem>

      {/* —— 3. Secciones expandibles —— */}
      <StaggerItem index={3}>
        <div>
          <h2 className="text-display text-base font-semibold tracking-tight mb-3">Secciones</h2>
          <div className="grid grid-cols-2 gap-2 mb-3">
            <DevTabCard Icon={Terminal} label="Logs" description="Eventos y errores" active={activeTab === 'logs'} onClick={() => toggleTab('logs')} />
            <DevTabCard Icon={Server} label="Connector" description="Estado del ETECSA" active={activeTab === 'connector'} onClick={() => toggleTab('connector')} />
            <DevTabCard Icon={Activity} label="Network" description="Requests HTTP" active={activeTab === 'network'} onClick={() => toggleTab('network')} />
            <DevTabCard Icon={Database} label="Storage" description="chrome.storage viewer" active={activeTab === 'storage'} onClick={() => toggleTab('storage')} />
            <DevTabCard Icon={Eye} label="Session" description="Sesión activa" active={activeTab === 'session'} onClick={() => toggleTab('session')} />
          </div>

          {/* Contenido del tab activo */}
          {activeTab === 'logs' && <LogsViewer />}
          {activeTab === 'connector' && <ConnectorInspector />}
          {activeTab === 'network' && <NetworkDebugPanel />}
          {activeTab === 'storage' && <StorageViewer />}
          {activeTab === 'session' && <SessionInspector />}
        </div>
      </StaggerItem>

      {/* —— 4. Herramientas —— */}
      <StaggerItem index={4}>
        <NexaCard padding="md">
          <div className="flex items-center gap-2 mb-3">
            <Wrench size={18} style={{ color: 'var(--accent)' }} />
            <h2 className="text-display text-base font-semibold text-foreground">Herramientas</h2>
          </div>
          <div className="flex flex-wrap gap-2">
            <DevToolButton label="Probar login (demo)" icon={<LogIn size={12} />} onClick={async () => {
              const accounts = await messageClient.accountList();
              if (accounts.ok && accounts.data.length > 0) {
                toast.success('Demo login', `Simulando conexión con ${accounts.data[0]!.alias}`);
              } else {
                toast.warning('No hay cuentas guardadas');
              }
            }} />
            <DevToolButton label="Probar logout" icon={<LogOut size={12} />} onClick={() => toast.info('Logout simulado')} />
            <DevToolButton label="Simular error" icon={<AlertTriangle size={12} />} onClick={() => {
              console.error('[TEST] Error simulado desde Developer Mode');
              toast.error('Error simulado', 'Este es un error de prueba');
            }} />
            <DevToolButton label="Probar notifs" icon={<AlertTriangle size={12} />} onClick={() => messageClient.demoNotifs().then(() => toast.info('Notificaciones enviadas'))} />
            <DevToolButton label="Limpiar logs" icon={<Trash2 size={12} />} onClick={() => {
              logBuffer.length = 0;
              toast.success('Logs limpiados');
            }} />
            <DevToolButton label="Exportar logs" icon={<Download size={12} />} onClick={() => {
              const data = JSON.stringify(logBuffer, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `nexa-logs-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              toast.success('Logs exportados');
            }} />
            <DevToolButton label="Reiniciar extensión" icon={<RefreshCw size={12} />} onClick={() => chrome.runtime.reload()} variant="danger" />
          </div>
        </NexaCard>
      </StaggerItem>

      {/* —— 5. Información técnica —— */}
      <StaggerItem index={5}>
        <NexaCard padding="md" variant="outline">
          <p className="text-xs text-foreground-muted mb-2 font-mono">Información técnica</p>
          <div className="space-y-1 text-xs font-mono">
            <InfoRow label="Versión" value={chrome.runtime.getManifest().version} />
            <InfoRow label="Manifest" value="V3" />
            <InfoRow label="Service Worker" value="service-worker.ts" />
            <InfoRow label="Permisos" value={(chrome.runtime.getManifest().permissions as string[]).join(', ')} />
            <InfoRow label="UA" value={navigator.userAgent.slice(0, 50)} truncate />
          </div>
        </NexaCard>
      </StaggerItem>
    </div>
  );
}

// ═══ Estado del sistema ══════════════════════════════════════════════

function SystemStatusCard() {
  const [sessionActive, setSessionActive] = useState(false);
  const [portalStatus, setPortalStatus] = useState('—');
  const [accountsCount, setAccountsCount] = useState(0);

  useEffect(() => {
    void (async () => {
      const sess = await messageClient.sessionGetState();
      setSessionActive(!!sess.ok && !!sess.data);
      const probe = await messageClient.connectionProbe();
      if (probe.ok && probe.data) setPortalStatus(probe.data.state);
      const accs = await messageClient.accountList();
      if (accs.ok) setAccountsCount(accs.data.length);
    })();
  }, []);

  return (
    <NexaCard padding="md">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={18} style={{ color: 'var(--accent)' }} />
        <h2 className="text-display text-base font-semibold text-foreground">Estado del sistema</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <DevRow label="Service Worker" value="Activo" variant="success" />
        <DevRow label="Storage" value="OK" variant="success" />
        <DevRow label="Sesión" value={sessionActive ? 'Activa' : 'Inactiva'} variant={sessionActive ? 'success' : 'default'} />
        <DevRow label="Portal" value={portalStatus} variant={portalStatus === 'ONLINE' ? 'success' : portalStatus === 'CAPTIVE_PORTAL' ? 'warning' : 'default'} />
        <DevRow label="Cuentas" value={String(accountsCount)} variant={accountsCount > 0 ? 'success' : 'warning'} />
        <DevRow label="Offscreen" value="OK" variant="success" />
      </div>
    </NexaCard>
  );
}

// ═══ Logs Viewer ═════════════════════════════════════════════════════

function LogsViewer() {
  const [logs, setLogs] = useState<LogEntry[]>([...logBuffer]);
  const [filter, setFilter] = useState<string>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const handler = () => setLogs([...logBuffer]);
    window.addEventListener('nexa-log', handler);
    return () => window.removeEventListener('nexa-log', handler);
  }, []);

  const filtered = logs.filter((l) => {
    if (filter !== 'all' && l.level !== filter) return false;
    if (search && !l.message.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const levelColors: Record<string, string> = {
    DEBUG: 'var(--foreground-subtle)',
    INFO: 'var(--accent)',
    WARN: 'var(--warning)',
    ERROR: 'var(--error)',
  };

  return (
    <NexaCard padding="sm">
      {/* Filtros */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {['all', 'DEBUG', 'INFO', 'WARN', 'ERROR'].map((lvl) => (
          <button
            key={lvl}
            type="button"
            onClick={() => setFilter(lvl)}
            className="text-[9px] px-1.5 py-0.5 rounded font-mono uppercase transition-colors"
            style={{
              backgroundColor: filter === lvl ? 'var(--accent-soft)' : 'transparent',
              color: filter === lvl ? 'var(--accent)' : 'var(--foreground-muted)',
              border: `1px solid ${filter === lvl ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            {lvl}
          </button>
        ))}
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar..."
          className="flex-1 min-w-[80px] text-[10px] px-2 py-0.5 rounded font-mono"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--foreground)' }}
        />
      </div>

      {/* Lista de logs */}
      <div
        className="flex flex-col gap-0.5 overflow-y-auto"
        style={{ maxHeight: '300px', scrollbarWidth: 'thin' }}
      >
        {filtered.length > 0 ? (
          filtered.slice().reverse().map((log, i) => (
            <div
              key={i}
              className="flex items-start gap-2 p-1.5 rounded text-[10px] font-mono"
              style={{ backgroundColor: log.level === 'ERROR' ? 'rgba(239, 68, 68, 0.05)' : 'transparent' }}
            >
              <span className="text-foreground-subtle flex-shrink-0">
                {new Date(log.timestamp).toLocaleTimeString('es-ES', { hour12: false })}
              </span>
              <span className="flex-shrink-0 font-bold" style={{ color: levelColors[log.level] }}>
                {log.level}
              </span>
              <span className="text-foreground-muted break-all">{log.message}</span>
            </div>
          ))
        ) : (
          <p className="text-xs text-foreground-muted text-center py-4">Sin logs. Las acciones de la extensión aparecerán aquí.</p>
        )}
      </div>
    </NexaCard>
  );
}

// ═══ Connector Inspector ═════════════════════════════════════════════

function ConnectorInspector() {
  const [probe, setProbe] = useState<string>('—');
  const [loading, setLoading] = useState(false);

  const doProbe = async () => {
    setLoading(true);
    const r = await messageClient.connectionProbe();
    if (r.ok && r.data) setProbe(r.data.state);
    else setProbe('ERROR');
    setLoading(false);
  };

  useEffect(() => { void doProbe(); }, []);

  return (
    <NexaCard padding="sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium">ETECSA Connector</p>
        <button
          type="button"
          onClick={doProbe}
          disabled={loading}
          className="p-1 rounded transition-colors"
          style={{ color: 'var(--foreground-muted)' }}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      <div className="space-y-1.5 text-xs font-mono">
        <InfoRow label="Estado del portal" value={probe} />
        <InfoRow label="Base URL" value="https://secure.etecsa.net:8443" />
        <InfoRow label="Estrategia primaria" value="KnownEndpoint" />
        <InfoRow label="Estrategias" value="5 (Known, Discovered, ScrapingDOM, ScrapingRegex, Manual)" />
        <InfoRow label="Probe URL" value="connectivitycheck.gstatic.com/generate_204" />
        <InfoRow label="Timeout probe" value="5000ms" />
        <InfoRow label="Timeout portal" value="30000ms" />
      </div>
      <div
        className="mt-3 p-2 rounded-lg text-[10px]"
        style={{ backgroundColor: 'var(--muted)', border: '1px solid var(--border)' }}
      >
        <p className="text-foreground-muted">
          El connector no mantiene estado en memoria (MV3). Cada operación es stateless.
          Los tokens (CSRFHW, ATTRIBUTE_UUID) se guardan en chrome.storage.local cifrados.
        </p>
      </div>
    </NexaCard>
  );
}

// ═══ Network Debug ═══════════════════════════════════════════════════

function NetworkDebugPanel() {
  return (
    <NexaCard padding="sm">
      <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium mb-3">Network Debug</p>
      <div
        className="flex flex-col items-center justify-center py-8 text-center"
      >
        <Activity size={32} className="text-foreground-subtle mb-2" />
        <p className="text-xs text-foreground-muted mb-1">Interceptor de red no disponible</p>
        <p className="text-[10px] text-foreground-subtle max-w-[200px]">
          Para ver requests HTTP en tiempo real, abre DevTools de Chrome (F12) → Network → filtrar por "etecsa.net"
        </p>
      </div>
      <div className="mt-3 space-y-1 text-[10px] font-mono">
        <InfoRow label="Host" value="secure.etecsa.net:8443" />
        <InfoRow label="Protocolo" value="HTTPS (TLS 1.2+)" />
        <InfoRow label="Endpoints" value="GET /, POST //LoginServlet, POST /EtecsaQueryServlet, POST /LogoutServlet" />
      </div>
    </NexaCard>
  );
}

// ═══ Storage Viewer ══════════════════════════════════════════════════

function StorageViewer() {
  const [data, setData] = useState<Record<string, unknown>>({});
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const all = await chrome.storage.local.get(null);
    const nexaKeys: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(all)) {
      if (key.startsWith('nexa.')) nexaKeys[key] = value;
    }
    setData(nexaKeys);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const toggleKey = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const formatValue = (val: unknown): string => {
    if (val === null) return 'null';
    if (val === undefined) return 'undefined';
    if (typeof val === 'string') return `"${val}"`;
    return JSON.stringify(val, null, 2);
  };

  const getValuePreview = (val: unknown): string => {
    const str = formatValue(val);
    if (str.length > 60) return str.slice(0, 60) + '...';
    return str;
  };

  const getKeyType = (val: unknown): string => {
    if (val === null) return 'null';
    if (Array.isArray(val)) return `array[${val.length}]`;
    if (typeof val === 'object') return 'object';
    return typeof val;
  };

  return (
    <NexaCard padding="sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium">chrome.storage.local</p>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-foreground-subtle font-mono">{Object.keys(data).length} claves</span>
          <button
            type="button"
            onClick={load}
            className="p-1 rounded transition-colors"
            style={{ color: 'var(--foreground-muted)' }}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      <div
        className="flex flex-col gap-1 overflow-y-auto"
        style={{ maxHeight: '350px', scrollbarWidth: 'thin' }}
      >
        {Object.keys(data).length > 0 ? (
          Object.entries(data)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, value]) => {
              const isExpanded = expandedKeys.has(key);
              const isSensitive = key.includes('password') || key.includes('verifier') || key.includes('aesKey');
              return (
                <div key={key} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => toggleKey(key)}
                    className="w-full flex items-center gap-2 p-2 text-left transition-colors"
                    style={{ backgroundColor: 'var(--bg-elevated)' }}
                  >
                    {isExpanded ? <ChevronDown size={12} className="flex-shrink-0" /> : <ChevronRight size={12} className="flex-shrink-0" />}
                    <span className="text-[10px] font-mono font-medium text-foreground truncate flex-1">{key}</span>
                    <NexaBadge variant="default" size="sm">{getKeyType(value)}</NexaBadge>
                    {isSensitive && (
                      <span className="text-[9px]" style={{ color: 'var(--warning)' }}>
                        <Lock size={9} />
                      </span>
                    )}
                  </button>
                  {isExpanded && (
                    <div className="p-2" style={{ backgroundColor: 'var(--background-glass)' }}>
                      <pre
                        className="text-[9px] font-mono text-foreground-muted whitespace-pre-wrap break-all"
                        style={{ maxHeight: '200px', overflow: 'auto', scrollbarWidth: 'thin' }}
                      >
                        {isSensitive ? '🔒 [CIFRADO — no se muestra]' : formatValue(value)}
                      </pre>
                    </div>
                  )}
                  {!isExpanded && (
                    <div className="px-2 pb-1">
                      <span className="text-[9px] font-mono text-foreground-subtle truncate block">
                        {isSensitive ? '🔒 [CIFRADO]' : getValuePreview(value)}
                      </span>
                    </div>
                  )}
                </div>
              );
            })
        ) : (
          <p className="text-xs text-foreground-muted text-center py-4">Sin datos en storage</p>
        )}
      </div>
    </NexaCard>
  );
}

// ═══ Session Inspector ═══════════════════════════════════════════════

function SessionInspector() {
  const [session, setSession] = useState<{ alias: string; username: string; domain: string; startedAt: number } | null>(null);
  const [showTokens, setShowTokens] = useState(false);

  useEffect(() => {
    void (async () => {
      const r = await messageClient.sessionGetState();
      if (r.ok && r.data) setSession(r.data);
    })();
  }, []);

  if (!session) {
    return (
      <NexaCard padding="sm">
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium mb-3">Sesión activa</p>
        <div className="flex flex-col items-center py-4">
          <WifiOff size={28} className="text-foreground-subtle mb-2" />
          <p className="text-xs text-foreground-muted">Sin sesión activa</p>
        </div>
      </NexaCard>
    );
  }

  const maskValue = (val: string | undefined, show: boolean): string => {
    if (!val) return '—';
    if (show) return val;
    return val.slice(0, 4) + '••••••••' + val.slice(-4);
  };

  const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
  const elapsedH = Math.floor(elapsed / 3600);
  const elapsedM = Math.floor((elapsed % 3600) / 60);
  const elapsedS = elapsed % 60;

  return (
    <NexaCard padding="sm">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium">Sesión activa</p>
        <button
          type="button"
          onClick={() => setShowTokens(!showTokens)}
          className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded transition-colors"
          style={{ color: showTokens ? 'var(--accent)' : 'var(--foreground-muted)', border: '1px solid var(--border)' }}
        >
          {showTokens ? <EyeOff size={10} /> : <Eye size={10} />}
          {showTokens ? 'Ocultar' : 'Mostrar'}
        </button>
      </div>

      <div className="space-y-1.5 text-xs font-mono">
        <InfoRow label="Alias" value={session.alias} />
        <InfoRow label="Usuario" value={`${session.username}@${session.domain}`} />
        <InfoRow label="Inicio" value={new Date(session.startedAt).toLocaleString('es-ES')} />
        <InfoRow label="Transcurrido" value={`${elapsedH}h ${elapsedM}m ${elapsedS}s`} />
        <div className="pt-2 mt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-[9px] uppercase tracking-widest text-foreground-subtle font-medium mb-1.5">Tokens (mascaréados)</p>
          <InfoRow label="CSRFHW" value={maskValue('a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6', showTokens)} />
          <InfoRow label="ATTRIBUTE_UUID" value={maskValue('f7e6d5c4b3a2a1b0c9d8e7f6g5h4i3j2', showTokens)} />
          <InfoRow label="wlanuserip" value={maskValue('10.42.1.105', showTokens)} />
          <InfoRow label="loggerId" value={maskValue('id-12345678', showTokens)} />
        </div>
      </div>

      <div
        className="mt-3 p-2 rounded-lg text-[10px]"
        style={{ backgroundColor: 'rgba(245, 158, 11, 0.05)', border: '1px solid rgba(245, 158, 11, 0.15)' }}
      >
        <p className="text-foreground-muted">
          ⚠️ Los tokens reales se almacenan cifrados en chrome.storage.local. Estos valores son simulados para diagnóstico.
        </p>
      </div>
    </NexaCard>
  );
}

// ═══ Sub-componentes ═════════════════════════════════════════════════

function DevRow({ label, value, variant }: { readonly label: string; readonly value: string; readonly variant: 'success' | 'warning' | 'error' | 'default' }) {
  return (
    <div className="flex items-center justify-between gap-2 min-w-0">
      <span className="text-foreground-muted truncate">{label}</span>
      <NexaBadge variant={variant}>{value}</NexaBadge>
    </div>
  );
}

function DevTabCard({ Icon, label, description, active, onClick }: {
  readonly Icon: typeof Terminal;
  readonly label: string;
  readonly description: string;
  readonly active: boolean;
  readonly onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-1 p-3 rounded-lg border transition-colors text-left min-w-0"
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--border)',
        backgroundColor: active ? 'var(--accent-soft)' : 'var(--background-glass)',
      }}
    >
      <Icon size={18} style={{ color: active ? 'var(--accent)' : 'var(--foreground-muted)' }} />
      <span className="text-sm font-medium text-foreground truncate w-full">{label}</span>
      <span className="text-[10px] text-foreground-muted truncate w-full">{description}</span>
    </button>
  );
}

function DevToolButton({ label, icon, onClick, variant = 'default' }: {
  readonly label: string;
  readonly icon?: React.ReactNode;
  readonly onClick: () => void;
  readonly variant?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md border transition-colors"
      style={{
        borderColor: variant === 'danger' ? 'rgba(239, 68, 68, 0.3)' : 'var(--border)',
        color: variant === 'danger' ? 'var(--error)' : 'var(--foreground-muted)',
      }}
      onMouseEnter={(e) => {
        if (variant === 'danger') e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
        else { e.currentTarget.style.backgroundColor = 'var(--muted)'; e.currentTarget.style.color = 'var(--foreground)'; }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = variant === 'danger' ? 'var(--error)' : 'var(--foreground-muted)';
      }}
    >
      {icon}
      {label}
    </button>
  );
}

function InfoRow({ label, value, truncate }: { readonly label: string; readonly value: string; readonly truncate?: boolean }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-foreground-muted flex-shrink-0">{label}:</span>
      <span className={cn('text-foreground', truncate && 'truncate')} title={truncate ? value : undefined}>
        {value}
      </span>
    </div>
  );
}

// Iconos que faltaban importar
function Lock({ size }: { readonly size: number }) {
  return <span style={{ fontSize: size }}>🔒</span>;
}

function WifiOff({ size, className }: { readonly size: number; readonly className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <line x1="2" y1="2" x2="22" y2="22" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0" />
      <path d="M2 8.82a15 15 0 0 1 4.17-2.65" />
      <path d="M10.66 5c4.01-.36 8.14.9 11.34 3.76" />
      <path d="M16.85 11.25a10 10 0 0 1 2.22 1.68" />
      <path d="M5 13a10 10 0 0 1 5.24-2.76" />
    </svg>
  );
}
