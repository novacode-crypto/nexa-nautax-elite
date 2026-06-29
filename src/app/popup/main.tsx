/**
 * NEXA NautaX — Popup entry point — v4
 */

import { StrictMode, useEffect, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { AppProviders } from '@/providers/AppProviders';
import { useCryptoStore } from '@/store/cryptoStore';
import { useSettingsStore } from '@/store/settingsStore';
import { OnboardingFlow } from '@/features/onboarding/components/OnboardingFlow';
import { UnlockScreen } from '@/features/unlock/components/UnlockScreen';
import { NexaLogo } from '@/components/nexa/NexaLogo';
import { NexaSpinner } from '@/components/nexa/NexaSpinner';
import '@/styles/fonts.css';
import '@/styles/tailwind.css';
import '@/themes/index.css';
import '@/styles/globals.css';
import './popup.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

function PaddedContainer({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex flex-col w-full h-full" style={{ padding: '16px', overflow: 'hidden', background: 'var(--background-gradient)' }}>
      {children}
    </div>
  );
}

function PopupRouter() {
  const initialized = useCryptoStore((s) => s.initialized);
  const locked = useCryptoStore((s) => s.locked);
  const hydrated = useCryptoStore((s) => s.hydrated);

  if (!hydrated) {
    return (
      <PaddedContainer>
        <div className="flex flex-col items-center justify-center w-full h-full gap-4">
          <NexaLogo size="md" />
          <NexaSpinner size="md" />
        </div>
      </PaddedContainer>
    );
  }

  if (!initialized) {
    return <PaddedContainer><OnboardingFlow /></PaddedContainer>;
  }

  if (locked) {
    return <PaddedContainer><UnlockScreen /></PaddedContainer>;
  }

  return <App />;
}

function Root() {
  const hydrateCrypto = useCryptoStore((s) => s.hydrate);
  const hydrateSettings = useSettingsStore((s) => s.hydrate);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Promise.all([hydrateCrypto(), hydrateSettings()]).finally(() => setReady(true));
  }, [hydrateCrypto, hydrateSettings]);

  if (!ready) {
    return (
      <PaddedContainer>
        <div className="flex flex-col items-center justify-center w-full h-full gap-4">
          <NexaLogo size="md" />
          <NexaSpinner size="md" />
        </div>
      </PaddedContainer>
    );
  }

  return <PopupRouter />;
}

createRoot(container).render(
  <StrictMode>
    <AppProviders>
      <Root />
    </AppProviders>
  </StrictMode>,
);
