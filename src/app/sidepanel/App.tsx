/**
 * NEXA NautaX — SidePanel App
 * Fase 5 — Implementación del Núcleo
 *
 * SidePanel con navegación entre 6 secciones:
 * - Dashboard
 * - Accounts
 * - Scheduler
 * - Settings
 * - Developer (solo si está activado en settings)
 * - Acerca de (pegado al footer del nav)
 */

import { SidePanelLayout } from '@/components/layout/SidePanelLayout';
import { useUiStore } from '@/store/uiStore';
import { DashboardOverview } from '@/features/dashboard/components/DashboardOverview';
import { AccountsView } from '@/features/accounts/components/AccountList';
import { SchedulerView } from '@/features/scheduler/components/SchedulerPanel';
import { SettingsView } from '@/features/settings/components/SettingsPanel';
import { DeveloperView } from '@/features/developer/components/DeveloperPanel';
import { AboutView } from '@/features/about/components/AboutView';

export function App() {
  const currentView = useUiStore((s) => s.sidePanelView);

  // key fuerza remount al cambiar de vista → re-ejecuta animaciones stagger
  return (
    <SidePanelLayout>
      {currentView === 'dashboard' && <DashboardOverview key="dashboard" />}
      {currentView === 'accounts' && <AccountsView key="accounts" />}
      {currentView === 'scheduler' && <SchedulerView key="scheduler" />}
      {currentView === 'settings' && <SettingsView key="settings" />}
      {currentView === 'developer' && <DeveloperView key="developer" />}
      {currentView === 'about' && <AboutView key="about" />}
    </SidePanelLayout>
  );
}
