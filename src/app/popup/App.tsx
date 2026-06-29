/**
 * NEXA NautaX — Popup App — v10
 *
 * + Botón DEMO para simular conexión
 * + ConnectedView rediseñado más vistoso
 * + Scheduler quick access
 * + Botones pegados encima del footer (no en el footer)
 * + Footer siempre igual (trust badges)
 */

import { useState, useEffect } from 'react';
import { LogIn, LogOut, RefreshCw, Plus, Check, ShieldCheck, Zap, Lock, AlertCircle, LayoutDashboard, FlaskConical, Globe, MapPin, Bell, AlertTriangle, X } from 'lucide-react';
import { PopupLayout } from '@/components/layout/PopupLayout';
import { NexaButton } from '@/components/nexa/NexaButton';
import { NexaCard } from '@/components/nexa/NexaCard';
import { NexaBanner } from '@/components/nexa/NexaBanner';
import { NexaCheckbox } from '@/components/nexa/NexaCheckbox';
import {
  NexaUsernameField,
  type NautaDomain,
} from '@/components/nexa/NexaUsernameField';
import {
  NexaAccountSelector,
  type AccountOption,
} from '@/components/nexa/NexaAccountSelector';
import { StaggerItem } from '@/components/nexa/StaggerAnimation';
import { SchedulerQuickAccess, type ScheduledDisconnect } from '@/components/nexa/SchedulerQuickAccess';
import type { ConnectionStatus } from '@/components/nexa/NexaStatusIndicator';
import { useToast } from '@/providers/ToastProvider';
import type { PopupView } from '@/store/uiStore';
import { useAccountStore } from '@/store/accountStore';
import { useSettingsStore } from '@/store/settingsStore';
import { messageClient } from '@/modules/messaging/messageClient';
import { useSessionTimer } from '@/hooks/useSessionTimer';

interface SessionInfo {
  alias: string;
  username: string;
  domain: string;
  avatar?: string | undefined;
  startedAt: number;
  totalSeconds?: number | null;
}

export function App() {
  const toast = useToast();
  const [view, setView] = useState<PopupView>('logged_out');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [activeSession, setActiveSession] = useState<SessionInfo | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [scheduledDisconnect, setScheduledDisconnect] = useState<ScheduledDisconnect | null>(null);
  const [disconnectedSession, setDisconnectedSession] = useState<SessionInfo | null>(null);
  const [disconnectedDuration, setDisconnectedDuration] = useState<string>('');
  const [retryCount, setRetryCount] = useState(0);
  const [retryAccountId, setRetryAccountId] = useState<string | null>(null);
  const [portalStatus, setPortalStatus] = useState<string>('UNKNOWN');
  const [showTakeControlDialog, setShowTakeControlDialog] = useState(false);
  const [takingControl, setTakingControl] = useState(false);

  const hydrate = useAccountStore((s) => s.hydrate);
  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    void checkActiveSession();
    void checkPortalStatus();
  }, []);

  const checkPortalStatus = async () => {
    const r = await messageClient.connectionProbe();
    if (r.ok && r.data) {
      setPortalStatus(r.data.state);
    }
  };

  // Sesión externa detectada: ONLINE pero sin sesión nuestra
  const externalSessionDetected = portalStatus === 'ONLINE' && !activeSession && view === 'logged_out';

  const checkActiveSession = async () => {
    const result = await messageClient.sessionGetState();
    if (result.ok && result.data) {
      setActiveSession(result.data);
      setView('connected');
      setStatus('connected');
    }
  };

  const handleLogin = async (accountId: string) => {
    setView('connecting');
    setStatus('connecting');
    setConnectionError(null);
    setRetryAccountId(accountId);
    const result = await messageClient.sessionLogin(accountId);
    if (result.ok) {
      setActiveSession(result.data);
      setView('connected');
      setStatus('connected');
      setRetryCount(0);
    } else {
      const newCount = retryCount + 1;
      setRetryCount(newCount);
      setConnectionError(result.error.userMessage);
      setView('error');
      setStatus('error');
    }
  };

  // Reintentar desde la vista de error
  const handleRetry = () => {
    if (retryCount >= 3) {
      // Sin intentos restantes → volver al inicio
      setRetryCount(0);
      setRetryAccountId(null);
      setView('logged_out');
      setStatus('disconnected');
      toast.warning('Máximo de intentos alcanzado. Verifica tu conexión e inténtalo más tarde.');
      return;
    }
    // Reconectar → ir a ConnectingView
    if (retryAccountId) {
      handleLogin(retryAccountId);
    } else {
      setView('logged_out');
      setStatus('disconnected');
    }
  };

  // Tomar control: hacer login con la cuenta seleccionada para forzar el cierre de la sesión externa
  const handleTakeControl = async () => {
    const accounts = useAccountStore.getState().accounts;
    const selectedId = useAccountStore.getState().selectedId;
    const target = accounts.find((a) => a.id === selectedId) ?? accounts[0];
    if (!target) {
      toast.warning('Selecciona una cuenta para tomar control');
      return;
    }
    setShowTakeControlDialog(false);
    setTakingControl(true);
    setView('connecting');
    setStatus('connecting');
    setConnectionError(null);
    setRetryAccountId(target.id);
    const result = await messageClient.sessionLogin(target.id);
    setTakingControl(false);
    if (result.ok) {
      setActiveSession(result.data);
      setView('connected');
      setStatus('connected');
      setRetryCount(0);
      toast.success('Control tomado', `Conectado con ${target.alias}`);
    } else {
      const newCount = retryCount + 1;
      setRetryCount(newCount);
      setConnectionError(result.error.userMessage);
      setView('error');
      setStatus('error');
    }
  };

  // DEMO: simular conexión sin ETECSA
  const handleDemo = () => {
    const accounts = useAccountStore.getState().accounts;
    const acc = accounts[0];
    if (!acc) {
      toast.warning('Crea una cuenta primero para el modo demo');
      return;
    }
    setActiveSession({
      alias: acc.alias,
      username: acc.username,
      domain: acc.domain,
      ...(acc.avatar ? { avatar: acc.avatar } : {}),
      startedAt: Date.now(),
      totalSeconds: 3600, // 1 hora simulada
    });
    setView('connected');
    setStatus('connected');
    toast.info('Modo DEMO: datos simulados');
  };

  const handleDemoNotifications = () => {
    // Disparar notificaciones desde el SW (badge + sonido + icono)
    void messageClient.demoNotifs();
    toast.info('Demo notificaciones enviada — mira el icono de la extensión');
  };

  const handleLogout = async () => {
    const sessionInfo = activeSession;
    // Capturar duración ANTES de limpiar la sesión (contador parado)
    let finalDuration = '00:00:00';
    if (sessionInfo) {
      const seconds = Math.floor((Date.now() - sessionInfo.startedAt) / 1000);
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      finalDuration = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    await messageClient.sessionLogout().catch(() => {});
    setActiveSession(null);
    setScheduledDisconnect(null);
    setStatus('disconnected');

    // Pasar por vista de desconexión antes de ir al inicio
    if (sessionInfo) {
      setDisconnectedSession(sessionInfo);
      setDisconnectedDuration(finalDuration);
      setView('disconnected');
      // Auto-pasar a logged_out después de 8 segundos si el usuario no hace click
      setTimeout(() => {
        setDisconnectedSession(null);
        setDisconnectedDuration('');
        setView('logged_out');
      }, 8000);
    } else {
      setView('logged_out');
    }
  };

  const openSidePanelDashboard = async () => {
    try {
      await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      chrome.storage.local.set({ 'nexa.ui.sidepanelView': 'dashboard' });
      window.close();
    } catch {
      toast.info('Abre el panel lateral desde el icono de NEXA');
    }
  };

  const handleSchedule = (minutes: number) => {
    setScheduledDisconnect({ minutes, setAt: Date.now() });

    // Notificación de aviso 5 min antes
    const warnMs = (minutes - 5) * 60 * 1000;
    if (warnMs > 0) {
      setTimeout(() => {
        toast.warning('Desconexión en 5 minutos');
      }, warnMs);
    }

    // Desconexión automática
    setTimeout(() => {
      toast.info('Desconectando...');
      handleLogout();
    }, minutes * 60 * 1000);
  };

  const handleCancelSchedule = () => {
    setScheduledDisconnect(null);
  };

  return (
    <PopupLayout status={status} footer={<PopupFooter />}>
      <div className="flex flex-col gap-3 min-w-0 h-full">
        {view === 'logged_out' && (
          <LoggedOutView
            onConnect={handleLogin}
            onDemo={handleDemo}
            onDemoNotifs={handleDemoNotifications}
            externalSessionDetected={externalSessionDetected}
          />
        )}
        {view === 'connecting' && <ConnectingView />}
        {view === 'connected' && activeSession && (
          <ConnectedView
            session={activeSession}
            scheduledDisconnect={scheduledDisconnect}
            onSchedule={handleSchedule}
            onCancelSchedule={handleCancelSchedule}
          />
        )}
        {view === 'error' && connectionError && (
          <ErrorView
            error={connectionError}
            attemptCount={retryCount}
            onRetry={handleRetry}
          />
        )}
        {view === 'offline' && <OfflineView />}
        {view === 'session_expired' && (
          <SessionExpiredView onReconnect={() => setView('logged_out')} />
        )}
        {view === 'disconnected' && disconnectedSession && (
          <DisconnectedView
            session={disconnectedSession}
            duration={disconnectedDuration}
            onReconnect={() => {
              setDisconnectedSession(null);
              // Reconectar con la misma cuenta
              const accounts = useAccountStore.getState().accounts;
              const match = accounts.find((a) => a.username === disconnectedSession.username && a.domain === disconnectedSession.domain);
              if (match) {
                handleLogin(match.id);
              } else {
                setView('logged_out');
              }
            }}
          />
        )}

        {/* Botones pegados encima del footer cuando está conectado */}
        {view === 'connected' && (
          <div className="flex items-center gap-2 mt-auto pt-2">
            <NexaButton
              variant="secondary"
              size="sm"
              fullWidth
              onClick={openSidePanelDashboard}
              icon={<LayoutDashboard size={14} />}
            >
              Dashboard
            </NexaButton>
            <NexaButton
              variant="danger"
              size="sm"
              fullWidth
              onClick={handleLogout}
              icon={<LogOut size={14} />}
            >
              Desconectar
            </NexaButton>
          </div>
        )}
      </div>

      {/* —— Diálogo: Tomar control —— */}
      {showTakeControlDialog && (
        <div
          className="fixed inset-0 flex items-center justify-center p-6"
          style={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.6)', backdropFilter: 'blur(4px)' }}
          onClick={() => setShowTakeControlDialog(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-elevated-2)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              boxShadow: '0 20px 40px -10px rgba(245, 158, 11, 0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'rgba(245, 158, 11, 0.2)' }}
            >
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
                <h2 className="text-display text-base font-semibold text-foreground">Tomar control</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowTakeControlDialog(false)}
                className="text-foreground-muted hover:text-foreground transition-colors"
                aria-label="Cerrar"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 flex flex-col gap-3">
              <p className="text-sm text-foreground leading-relaxed">
                Se cerrará la sesión externa actual y se conectará con tu cuenta{' '}
                <strong>{useAccountStore.getState().accounts.find((a) => a.id === useAccountStore.getState().selectedId)?.alias ?? useAccountStore.getState().accounts[0]?.alias ?? 'seleccionada'}</strong>.
              </p>
              <div
                className="flex items-start gap-2 p-3 rounded-lg text-xs"
                style={{
                  backgroundColor: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  color: 'var(--error)',
                }}
              >
                <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
                <span>
                  Si el login falla (credenciales incorrectas, saldo insuficiente), la sesión externa ya se habrá cerrado y podrías quedarte sin conexión temporalmente.
                </span>
              </div>
              <div className="flex gap-2.5 pt-2">
                <NexaButton variant="ghost" fullWidth onClick={() => setShowTakeControlDialog(false)}>
                  Cancelar
                </NexaButton>
                <NexaButton
                  variant="primary"
                  fullWidth
                  glow
                  loading={takingControl}
                  onClick={handleTakeControl}
                  icon={<LogIn size={16} />}
                >
                  Tomar control
                </NexaButton>
              </div>
            </div>
          </div>
        </div>
      )}
    </PopupLayout>
  );
}

// ═══ Vista: Logged out ═════════════════════════════════════════════

function LoggedOutView({
  onConnect,
  onDemo,
  onDemoNotifs,
  externalSessionDetected,
}: {
  readonly onConnect: (accountId: string) => void;
  readonly onDemo: () => void;
  readonly onDemoNotifs: () => void;
  readonly externalSessionDetected: boolean;
}) {
  const accounts = useAccountStore((s) => s.accounts);
  const storeSelectedId = useAccountStore((s) => s.selectedId);
  const refresh = useAccountStore((s) => s.refresh);
  const demoMode = useSettingsStore((s) => s.settings.developer.demoMode);
  const [username, setUsername] = useState('');
  const [domain, setDomain] = useState<NautaDomain>('nauta.com.cu');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const toast = useToast();

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const accountOptions: readonly AccountOption[] = accounts.map((a) => ({
    id: a.id,
    alias: a.alias,
    username: a.username,
    domain: a.domain,
    type: a.type,
    ...(a.avatar ? { avatar: a.avatar } : {}),
  }));

  useEffect(() => {
    if (accounts.length > 0) {
      const targetId = storeSelectedId ?? accounts[0]!.id;
      const target = accounts.find((a) => a.id === targetId) ?? accounts[0]!;
      if (target) {
        setSelectedAccountId(target.id);
        setUsername(target.username);
        setDomain(target.domain);
        setPassword('••••••••');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, storeSelectedId]);

  const handleAccountSelect = (account: AccountOption) => {
    setSelectedAccountId(account.id);
    setUsername(account.username);
    setDomain(account.domain);
    setPassword('••••••••');
  };

  const handleConnect = () => {
    if (!selectedAccountId) {
      if (username.trim()) {
        const match = accounts.find((a) => a.username === username.trim() && a.domain === domain);
        if (match) {
          if (externalSessionDetected) {
            toast.warning('Ya hay una sesión activa', 'Desconéctate de ETECSA primero (desde el portal o el dispositivo donde la iniciaste) y luego vuelve a intentar.');
            return;
          }
          onConnect(match.id);
          return;
        }
      }
      toast.warning('Selecciona una cuenta para conectar');
      return;
    }
    if (externalSessionDetected) {
      toast.warning('Ya hay una sesión activa', 'Desconéctate de ETECSA primero (desde el portal o el dispositivo donde la iniciaste) y luego vuelve a intentar.');
      return;
    }
    onConnect(selectedAccountId);
  };

  const openSidePanelAccounts = async () => {
    try {
      await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      chrome.storage.local.set({ 'nexa.ui.sidepanelView': 'accounts' });
      window.close();
    } catch {
      toast.info('Abre el panel lateral desde el icono de NEXA');
    }
  };

  const hasAccounts = accounts.length > 0;

  return (
    <>
      {/* Aviso: sesión externa detectada (solo informativo) */}
      {externalSessionDetected && (
        <StaggerItem index={0}>
          <div
            className="flex items-center gap-2 rounded-lg p-2"
            style={{
              backgroundColor: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.25)',
            }}
          >
            <Globe size={14} style={{ color: 'var(--warning)' }} className="flex-shrink-0" />
            <span className="text-[11px] font-medium flex-1" style={{ color: 'var(--warning)' }}>
              Sesión externa detectada
            </span>
          </div>
        </StaggerItem>
      )}

      <StaggerItem index={externalSessionDetected ? 1 : 0}>
        <div className="text-center py-0.5 mb-2">
          <h1 className="text-display text-xl font-bold tracking-tight mb-0.5">Acceder a tu sesión</h1>
          <p className="text-xs text-foreground-muted">Conecta con tu cuenta ETECSA Nauta</p>
        </div>
      </StaggerItem>

      {hasAccounts && (
        <>
          <StaggerItem index={1}>
            <NexaAccountSelector accounts={accountOptions} selectedId={selectedAccountId} onSelect={handleAccountSelect} onAddAccount={openSidePanelAccounts} />
          </StaggerItem>
          <StaggerItem index={2}>
            <div className="flex items-center gap-3 py-0.5">
              <div className="flex-1 h-px" style={{ background: 'var(--border-gradient)' }} />
              <span className="text-[10px] uppercase tracking-widest font-medium text-foreground-subtle whitespace-nowrap">o ingresa manualmente</span>
              <div className="flex-1 h-px" style={{ background: 'var(--border-gradient)' }} />
            </div>
          </StaggerItem>
        </>
      )}

      <StaggerItem index={3}>
        <NexaUsernameField id="popup-username" label="Usuario" value={username} domain={domain} onChange={(u, d) => { setUsername(u); setDomain(d); }} placeholder="pepe.perez" />
      </StaggerItem>

      <StaggerItem index={4}>
        <div className="w-full">
          <label className="block text-[10px] uppercase tracking-widest font-medium text-foreground-muted mb-1.5">Contraseña</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Tu contraseña Nauta" className="h-11 w-full rounded-lg px-3 text-sm text-foreground placeholder:text-foreground-subtle focus:outline-none transition-all" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }} onFocus={(e) => { if (password === '••••••••') setPassword(''); e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--focus-ring), var(--glow-accent)'; }} onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.1)'; }} />
          {hasAccounts && selectedAccountId && password === '••••••••' && (
            <p className="mt-1 text-[10px] text-foreground-subtle flex items-center gap-1"><Check size={10} style={{ color: 'var(--success)' }} /> Contraseña guardada — click para editar</p>
          )}
        </div>
      </StaggerItem>

      <StaggerItem index={5}>
        <NexaCheckbox checked={remember} onChange={(e: React.ChangeEvent<HTMLInputElement>) => setRemember(e.target.checked)} label="Recordar contraseña" />
      </StaggerItem>

      <StaggerItem index={6}>
        <NexaButton
          variant="primary"
          fullWidth
          size="lg"
          glow
          onClick={handleConnect}
          icon={<LogIn size={16} />}
          disabled={!selectedAccountId && !username}
        >
          Conectar
        </NexaButton>
      </StaggerItem>

      <StaggerItem index={7}>
        <div className="flex items-center justify-between text-xs gap-2">
          <button type="button" className="text-accent hover:underline flex items-center gap-1 font-medium" onClick={openSidePanelAccounts}><Plus size={12} /> Agregar cuenta</button>
          {/* Badges Demo + Notifs (solo cuando el modo demo global está activado) */}
          {demoMode && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onDemo}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider transition-all"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  border: '1px solid var(--accent)',
                }}
                title="Simular conexión de demo"
              >
                <FlaskConical size={10} />
                Demo
              </button>
              <button
                type="button"
                onClick={onDemoNotifs}
                className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium uppercase tracking-wider transition-all"
                style={{
                  backgroundColor: 'rgba(245, 158, 11, 0.08)',
                  color: 'var(--warning)',
                  border: '1px solid var(--warning)',
                }}
                title="Probar notificaciones"
              >
                <Bell size={10} />
                Notifs
              </button>
            </div>
          )}
        </div>
      </StaggerItem>
    </>
  );
}

// ═══ Vista: Connecting ═════════════════════════════════════════════

function ConnectingView() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-12">
      <div className="relative">
        <div className="absolute inset-0 rounded-full opacity-50 animate-ping" style={{ background: 'var(--accent)', filter: 'blur(20px)' }} />
        <div className="relative flex items-center justify-center h-16 w-16 rounded-full" style={{ backgroundColor: 'var(--accent-soft)' }}>
          <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--accent)' }} />
        </div>
      </div>
      <div className="text-center">
        <h2 className="text-display text-2xl font-bold tracking-tight mb-1">Conectando<span className="text-gradient">...</span></h2>
        <p className="text-sm text-foreground-muted">Conectando con ETECSA</p>
      </div>
    </div>
  );
}

// ═══ Vista: Connected — Rediseñada asimétrica v2 ══════════════════

function ConnectedView({
  session,
  scheduledDisconnect,
  onSchedule,
  onCancelSchedule,
}: {
  readonly session: SessionInfo;
  readonly scheduledDisconnect: ScheduledDisconnect | null;
  readonly onSchedule: (minutes: number) => void;
  readonly onCancelSchedule: () => void;
}) {
  const timer = useSessionTimer(session.startedAt, session.totalSeconds ?? null);
  const isInternational = session.domain === 'nauta.com.cu';

  return (
    <>
      {/* Hero: Tiempo restante — protagonista, centrado, grande */}
      <StaggerItem index={0}>
        <NexaCard padding="lg" glow className="text-center relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 pointer-events-none" style={{ background: 'var(--primary-gradient)', filter: 'blur(40px)' }} />
          <div className="relative">
            <p className="text-[10px] uppercase tracking-widest text-foreground-subtle font-medium mb-1">
              Tiempo restante
            </p>
            <p
              className="text-display text-5xl font-bold font-mono tracking-tight"
              style={{
                backgroundImage: 'var(--gradient-text-primary)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {timer.remainingFormatted}
            </p>
          </div>
        </NexaCard>
      </StaggerItem>

      {/* Contador conectado en card + scheduler como texto link */}
      <StaggerItem index={1}>
        <div className="flex items-center gap-3">
          <NexaCard padding="sm" className="flex-shrink-0">
            <p className="text-[9px] uppercase tracking-widest text-foreground-subtle font-medium">Conectado</p>
            <p className="text-sm font-bold font-mono text-foreground">{timer.connectedFormatted}</p>
          </NexaCard>

          {/* Scheduler como texto link */}
          <div className="flex-1 min-w-0">
            <SchedulerQuickAccess
              onSchedule={onSchedule}
              onCancel={onCancelSchedule}
              active={scheduledDisconnect}
            />
          </div>
        </div>
      </StaggerItem>

      {/* Card de cuenta activa — todo el ancho, avatar + info + SOLO icono de tipo */}
      <StaggerItem index={2}>
        <NexaCard padding="md">
          <div className="flex items-center gap-3">
            {session.avatar ? (
              <img src={session.avatar} alt={session.alias} className="h-10 w-10 rounded-full object-cover flex-shrink-0" style={{ border: '2px solid var(--border-strong)' }} />
            ) : (
              <div className="flex items-center justify-center h-10 w-10 rounded-full text-sm font-bold flex-shrink-0" style={{ background: 'var(--primary-gradient)', color: 'var(--primary-foreground)' }}>
                {session.alias.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground truncate">{session.alias}</p>
              <p className="text-[10px] text-foreground-muted font-mono truncate">{session.username}@{session.domain}</p>
            </div>
            {/* Solo el icono de tipo de cuenta */}
            {isInternational ? (
              <Globe size={16} style={{ color: 'var(--accent)' }} className="flex-shrink-0" />
            ) : (
              <MapPin size={16} style={{ color: 'var(--accent)' }} className="flex-shrink-0" />
            )}
          </div>
        </NexaCard>
      </StaggerItem>
    </>
  );
}

// ═══ Vista: Error ══════════════════════════════════════════════════

function ErrorView({ error, onRetry, attemptCount }: { readonly error: string; readonly onRetry: () => void; readonly attemptCount: number }) {
  const maxAttempts = 3;
  const remaining = maxAttempts - attemptCount;

  return (
    <div className="flex flex-col gap-5 items-center text-center w-full h-full justify-center">
      <StaggerItem index={0}>
        <div className="flex items-center justify-center h-16 w-16 rounded-full" style={{ backgroundColor: 'rgba(239, 68, 68, 0.12)' }}>
          <AlertCircle size={32} style={{ color: 'var(--error)' }} />
        </div>
      </StaggerItem>
      <StaggerItem index={1}>
        <div>
          <h1 className="text-display text-xl font-bold tracking-tight mb-1">No se pudo conectar</h1>
          <p className="text-sm text-foreground-muted max-w-xs">{error}</p>
        </div>
      </StaggerItem>
      <StaggerItem index={2}>
        <div className="w-full rounded-lg p-3 flex items-start gap-2.5 text-left" style={{ backgroundColor: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
          <AlertCircle size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--error)' }} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground mb-1">Posibles causas:</p>
            <ul className="text-[10px] text-foreground-muted space-y-0.5 list-disc list-inside">
              <li>Credenciales incorrectas</li>
              <li>Sesión ya activa en otro dispositivo</li>
              <li>Saldo insuficiente</li>
              <li>ETECSA limitó los intentos</li>
              <li>No hay conexión a internet</li>
              <li>VPN o proxy activos interfiriendo</li>
              <li>Portal ETECSA no disponible temporalmente</li>
            </ul>
          </div>
        </div>
      </StaggerItem>

      {/* Contador de intentos */}
      {remaining > 0 && (
        <StaggerItem index={3}>
          <p className="text-[10px] text-foreground-subtle">
            Intento {attemptCount} de {maxAttempts} · Quedan {remaining} {remaining === 1 ? 'intento' : 'intentos'}
          </p>
        </StaggerItem>
      )}

      <StaggerItem index={4}>
        {remaining > 0 ? (
          <NexaButton variant="primary" fullWidth size="lg" glow onClick={onRetry} icon={<RefreshCw size={16} />}>
            Reconectar
          </NexaButton>
        ) : (
          <NexaButton variant="secondary" fullWidth size="lg" onClick={onRetry}>
            Volver al inicio
          </NexaButton>
        )}
      </StaggerItem>
    </div>
  );
}

// ═══ Vista: Offline ════════════════════════════════════════════════

function OfflineView() {
  return (
    <StaggerItem index={0}>
      <NexaBanner variant="warning" title="Sin conexión con ETECSA">Operaciones de ETECSA no disponibles.</NexaBanner>
    </StaggerItem>
  );
}

// ═══ Vista: Session expired ════════════════════════════════════════

function SessionExpiredView({ onReconnect }: { readonly onReconnect: () => void }) {
  return (
    <>
      <StaggerItem index={0}>
        <NexaBanner variant="warning" title="Sesión expirada" message="ETECSA cerró la sesión." />
      </StaggerItem>
      <StaggerItem index={1}>
        <NexaButton variant="primary" fullWidth glow onClick={onReconnect} icon={<RefreshCw size={16} />}>Reconectar</NexaButton>
      </StaggerItem>
    </>
  );
}

// ═══ Vista: Disconnected — info + reconectar con countdown ═════════

function DisconnectedView({
  session,
  duration,
  onReconnect,
}: {
  readonly session: SessionInfo;
  readonly duration: string;
  readonly onReconnect: () => void;
}) {
  const [countdown, setCountdown] = useState(8);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col gap-5 items-center text-center w-full h-full justify-center">
      <StaggerItem index={0}>
        <div className="flex items-center justify-center h-16 w-16 rounded-full" style={{ backgroundColor: 'rgba(16, 185, 129, 0.12)' }}>
          <Check size={32} style={{ color: 'var(--success)' }} />
        </div>
      </StaggerItem>

      <StaggerItem index={1}>
        <div>
          <h1 className="text-display text-xl font-bold tracking-tight mb-1">Sesión cerrada</h1>
          <p className="text-sm text-foreground-muted">Te has desconectado correctamente</p>
        </div>
      </StaggerItem>

      <StaggerItem index={2}>
        <div className="rounded-xl p-3 flex items-center gap-3 w-full" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          {session.avatar ? (
            <img src={session.avatar} alt={session.alias} className="h-10 w-10 rounded-full object-cover flex-shrink-0" style={{ border: '1px solid var(--border)' }} />
          ) : (
            <div className="flex items-center justify-center h-10 w-10 rounded-full text-sm font-bold flex-shrink-0" style={{ background: 'var(--primary-gradient)', color: 'var(--primary-foreground)' }}>
              {session.alias.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1 text-left">
            <p className="text-sm font-medium text-foreground truncate">{session.alias}</p>
            <p className="text-[10px] text-foreground-muted font-mono truncate">{session.username}@{session.domain}</p>
            <p className="text-[10px] text-foreground-subtle mt-0.5">
              Duración: <span className="font-mono text-foreground">{duration}</span>
            </p>
          </div>
        </div>
      </StaggerItem>

      <StaggerItem index={3}>
        <div className="flex flex-col items-center gap-2">
          <NexaButton variant="primary" size="lg" glow onClick={onReconnect} icon={<LogIn size={16} />}>
            ¿Reconectar?
          </NexaButton>
          {countdown > 0 && (
            <p className="text-[10px] text-foreground-subtle font-mono">
              Regresando al inicio en {countdown}s
            </p>
          )}
        </div>
      </StaggerItem>
    </div>
  );
}

// ═══ Footer — siempre igual (trust badges) ═════════════════════════

function PopupFooter() {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex items-center gap-3 text-[10px] text-foreground-subtle">
        <span className="flex items-center gap-1"><ShieldCheck size={11} /> AES-256</span>
        <span className="flex items-center gap-1"><Zap size={11} /> Local</span>
        <span className="flex items-center gap-1"><Lock size={11} /> Privado</span>
      </div>
      <span className="font-mono text-[10px] text-foreground-subtle">v1.0.0</span>
    </div>
  );
}
