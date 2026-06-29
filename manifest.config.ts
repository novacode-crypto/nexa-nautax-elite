import { defineManifest } from '@crxjs/vite-plugin';

export default defineManifest({
  manifest_version: 3,
  name: '__MSG_extName__',
  short_name: '__MSG_extShortName__',
  version: '1.0.0',
  description: '__MSG_extDescription__',
  default_locale: 'es',

  action: {
    default_popup: 'src/app/popup/index.html',
    default_icon: {
      '16': 'public/icons/icon-16.png',
      '32': 'public/icons/icon-32.png',
      '48': 'public/icons/icon-48.png',
      '128': 'public/icons/icon-128.png',
    },
  },

  background: {
    service_worker: 'src/app/background/service-worker.ts',
    type: 'module',
  },

  side_panel: {
    default_path: 'src/app/sidepanel/index.html',
  },

  permissions: [
    'storage',
    'alarms',
    'sidePanel',
    'offscreen',
    'history',
  ],

  host_permissions: [
    'https://secure.etecsa.net:8443/*',
    'http://connectivitycheck.gstatic.com/*',
    'http://www.google.com/*',
  ],

  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'; base-uri 'self'; form-action 'self'",
  },

  icons: {
    '16': 'public/icons/icon-16.png',
    '32': 'public/icons/icon-32.png',
    '48': 'public/icons/icon-48.png',
    '128': 'public/icons/icon-128.png',
  },
});
