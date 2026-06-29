/**
 * NEXA NautaX — SidePanel entry point
 */

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProviders } from '@/providers/AppProviders';
import { useCryptoStore } from '@/store/cryptoStore';
import { useSettingsStore } from '@/store/settingsStore';
import { useUiStore } from '@/store/uiStore';
import '@/styles/fonts.css';
import '@/styles/tailwind.css';
import '@/themes/index.css';
import '@/styles/globals.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

// Al montar, verificar si el popup pidió navegar a una vista específica
chrome.storage.local.get('nexa.ui.sidepanelView').then((result) => {
  const view = result['nexa.ui.sidepanelView'];
  if (view) {
    useUiStore.getState().setSidePanelView(view as 'dashboard' | 'accounts' | 'scheduler' | 'settings' | 'developer');
    chrome.storage.local.remove('nexa.ui.sidepanelView');
  }
});

// Escuchar cambios en vivo
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  const change = changes['nexa.ui.sidepanelView'];
  if (change && change.newValue) {
    useUiStore.getState().setSidePanelView(change.newValue as 'dashboard' | 'accounts' | 'scheduler' | 'settings' | 'developer');
    chrome.storage.local.remove('nexa.ui.sidepanelView');
  }
});

// Hidratar stores antes de renderizar
Promise.all([useSettingsStore.getState().hydrate(), useCryptoStore.getState().hydrate()]).finally(
  () => {
    createRoot(container).render(
      <StrictMode>
        <AppProviders>
          <App />
        </AppProviders>
      </StrictMode>,
    );
  },
);
