/**
 * NEXA NautaX — Icon Generator
 *
 * Genera iconos PNG para la extensión en 4 tamaños (16, 32, 48, 128)
 * y 6 estados de sesión (default, connected, reconnecting, disconnected, no-account, error).
 *
 * Los iconos usan el gradient del tema accent del logo NEXA.
 *
 * Uso: node scripts/generate-icons.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.join(__dirname, '..', 'public', 'icons');

// SVG template para el icono NEXA con "N" estilizada
function generateIconSVG(size, variant = 'default') {
  // Colores por variante
  const variants = {
    default: { bg1: '#6366f1', bg2: '#8b5cf6', bg3: '#a855f7', ring: '#6366f1' },
    connected: { bg1: '#10b981', bg2: '#059669', bg3: '#34d399', ring: '#10b981' },
    reconnecting: { bg1: '#f59e0b', bg2: '#d97706', bg3: '#fbbf24', ring: '#f59e0b' },
    disconnected: { bg1: '#71717a', bg2: '#52525b', bg3: '#a1a1aa', ring: '#71717a' },
    'no-account': { bg1: '#71717a', bg2: '#52525b', bg3: '#a1a1aa', ring: '#71717a' },
    error: { bg1: '#ef4444', bg2: '#dc2626', bg3: '#f87171', ring: '#ef4444' },
  };

  const v = variants[variant] ?? variants.default;
  const id = `icon-${variant}-${size}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="128" y2="128" gradientUnits="userSpaceOnUse">
      <stop stop-color="${v.bg1}"/>
      <stop offset="0.5" stop-color="${v.bg2}"/>
      <stop offset="1" stop-color="${v.bg3}"/>
    </linearGradient>
    <linearGradient id="${id}-shine" x1="0" y1="0" x2="0" y2="128" gradientUnits="userSpaceOnUse">
      <stop stop-color="rgba(255,255,255,0.3)"/>
      <stop offset="0.5" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="28" fill="url(#${id}-bg)"/>
  <rect width="128" height="64" rx="28" fill="url(#${id}-shine)"/>
  <path d="M36 92V36h10l36 38V36h10v56H82L46 54v38H36z" fill="white" fill-opacity="0.95"/>
</svg>`;
}

// Tamaños estándar de Chrome extension
const SIZES = [16, 32, 48, 128];

// Variantes por estado
const VARIANTS = ['default', 'connected', 'reconnecting', 'disconnected', 'no-account', 'error'];

// Generar iconos
console.log('Generando iconos NEXA NautaX (PNG)...\n');

// Asegurar que el directorio existe
fs.mkdirSync(ICONS_DIR, { recursive: true });
fs.mkdirSync(path.join(ICONS_DIR, 'icon-states'), { recursive: true });

async function generatePNG(svg, filepath, size) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(filepath);
}

// Iconos base (default) → icon-16.png, icon-32.png, etc.
for (const size of SIZES) {
  const svg = generateIconSVG(size, 'default');
  const filename = `icon-${size}.png`;
  await generatePNG(svg, path.join(ICONS_DIR, filename), size);
  console.log(`  ✓ ${filename}`);
}

// Iconos por estado → icon-states/connected-16.png, etc.
for (const variant of VARIANTS) {
  for (const size of SIZES) {
    const svg = generateIconSVG(size, variant);
    const filename = `${variant}-${size}.png`;
    await generatePNG(svg, path.join(ICONS_DIR, 'icon-states', filename), size);
    console.log(`  ✓ icon-states/${filename}`);
  }
}

// Icon source SVG editable (alta resolución)
const sourceSvg = generateIconSVG(512, 'default');
fs.writeFileSync(path.join(ICONS_DIR, 'icon-source.svg'), sourceSvg);
console.log('\n  ✓ icon-source.svg (editable)');

console.log(`\n✓ ${SIZES.length * VARIANTS.length + SIZES.length} iconos PNG generados en ${ICONS_DIR}`);
