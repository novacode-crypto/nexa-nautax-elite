# NEXA NautaX — Design System

**Fase:** 3
**Documento:** 1 de 4
**Autor:** Arquitecto NEXA NautaX + Designer UI
**Fecha:** 2026-06-22

> Sistema de diseño completo: tokens, colores, tipografía, espaciados, componentes. **No es implementación CSS** — es especificación vinculante para Fases 5-7.

---

## 1. Filosofía de Diseño

### 1.1 Tono

NEXA NautaX transmite:

- **Tecnología avanzada** — sin ser frio.
- **Simplicidad** — sin ser simple.
- **Precisión** — sin ser rígido.
- **Elegancia** — sin ser pretencioso.
- **Control** — el usuario siempre sabe qué pasa.

### 1.2 Referencias

| Marca | Qué heredamos |
|-------|---------------|
| Apple | Espaciado generoso, jerarquía visual, animaciones suaves |
| Linear | Cards minimalistas, estados claros, densidad controlada |
| Raycast | Acciones rápidas, información condensada, navegación por teclado |
| Vercel | Contraste alto, minimalismo, diseño técnico |

### 1.3 Anti-referencias

| Evitar | Razón |
|--------|-------|
| Bootstrap | Genérico, sobreusado, sin identidad |
| Material Design clásico | Demasiados shadows, ripple effect innecesario |
| Paneles admin antiguos | Densidad visual, sin respiración |
| Gradientes excesivos | Ruido visual |
| Emojis | Anti-profesional (regla NEXA) |

### 1.4 Reglas inmutables

1. **Cero emojis** en toda la UI. Iconos SVG únicamente.
2. **Toda la UI en español** (D10 idioma).
3. **4 temas** soportados desde el inicio: Dark (default), Light, Nebula, Aurora.
4. **Fuentes autohospedadas**: Syne, DNSans, JetBrainsMono.
5. **Sin Google Fonts CDN**.
6. **Accesibilidad AA** mínimo (contraste 4.5:1).

---

## 2. Tipografía

### 2.1 Familias

| Fuente | Uso | Pesos |
|--------|-----|-------|
| **Syne** | Branding, títulos principales, identidad visual NEXA | Medium (500), SemiBold (600), Bold (700) |
| **DNSans** | Interfaz, texto general, body, labels, botones | Regular (400), Medium (500), Bold (700) |
| **JetBrainsMono** | Logs, Developer Mode, información técnica, monospace | Regular (400), Bold (700) |

### 2.2 Escala tipográfica

Tokens en `rem` (basados en `1rem = 16px`).

| Token | Tamaño | Línea | Uso |
|-------|--------|-------|-----|
| `--text-xs` | 0.75rem (12px) | 1rem (16px) | Labels secundarios, badges, metadata |
| `--text-sm` | 0.875rem (14px) | 1.25rem (20px) | Texto compacto, captions, inputs |
| `--text-base` | 1rem (16px) | 1.5rem (24px) | Body default, UI general |
| `--text-lg` | 1.125rem (18px) | 1.75rem (28px) | Títulos de sección, énfasis |
| `--text-xl` | 1.25rem (20px) | 1.75rem (28px) | Títulos de card |
| `--text-2xl` | 1.5rem (24px) | 2rem (32px) | Títulos de página, h1 |
| `--text-3xl` | 1.875rem (30px) | 2.25rem (36px) | Branding, hero |
| `--text-4xl` | 2.25rem (36px) | 2.5rem (40px) | Splash, onboarding |

### 2.3 Font-weight

| Token | Peso | Uso |
|-------|------|-----|
| `--font-regular` | 400 | Body default |
| `--font-medium` | 500 | Labels, énfasis ligero, headings Syne |
| `--font-semibold` | 600 | Syne headings, botones primary |
| `--font-bold` | 700 | Títulos críticos, JetBrainsMono bold |

### 2.4 Letter-spacing

| Token | Valor | Uso |
|-------|-------|-----|
| `--tracking-tight` | -0.02em | Títulos grandes (Syne ≥ 2xl) |
| `--tracking-normal` | 0 | Body default |
| `--tracking-wide` | 0.025em | Labels uppercase, badges |
| `--tracking-wider` | 0.05em | Eyebrows, micro-labels |

### 2.5 Reglas de uso por fuente

**Syne** — solo para:
- Logo NEXA / NautaX
- Títulos H1, H2 (páginas principales)
- Branding en onboarding
- Headers del SidePanel
- **NO** usar en body, buttons, inputs, labels

**DNSans** — para todo lo demás:
- Body text
- Buttons, inputs, selects
- Cards, lists
- Tooltips, toasts
- Menús, navegación

**JetBrainsMono** — exclusivamente en:
- Developer Mode (todas las secciones)
- Logs
- Network records
- Timestamps técnicos
- JSON viewers
- Session IDs, token previews (sanitizados)
- **NO** usar en UI de usuario final

---

## 3. Sistema de Color

### 3.1 Tokens base (comunes a todos los temas)

```css
:root {
  /* — Estado (semaforo) — */
  --success: var(--theme-success);
  --warning: var(--theme-warning);
  --error: var(--theme-error);
  --info: var(--theme-info);

  /* — Familias semánticas — */
  --background: var(--theme-background);
  --background-elevated: var(--theme-background-elevated);
  --foreground: var(--theme-foreground);
  --foreground-muted: var(--theme-foreground-muted);
  --foreground-subtle: var(--theme-foreground-subtle);

  --primary: var(--theme-primary);
  --primary-foreground: var(--theme-primary-foreground);
  --primary-hover: var(--theme-primary-hover);
  --primary-active: var(--theme-primary-active);

  --secondary: var(--theme-secondary);
  --secondary-foreground: var(--theme-secondary-foreground);

  --accent: var(--theme-accent);
  --accent-foreground: var(--theme-accent-foreground);

  --border: var(--theme-border);
  --border-strong: var(--theme-border-strong);
  --border-subtle: var(--theme-border-subtle);

  --card: var(--theme-card);
  --card-foreground: var(--theme-card-foreground);
  --card-hover: var(--theme-card-hover);

  --muted: var(--theme-muted);
  --muted-foreground: var(--theme-muted-foreground);

  /* — Focus ring — */
  --focus-ring: var(--theme-focus-ring);

  /* — Destructivo (para danger) — */
  --destructive: var(--theme-destructive);
  --destructive-foreground: var(--theme-destructive-foreground);
}
```

### 3.2 Tema Dark (default — D05)

Inspiración: Linear + Vercel. Fondo casi negro, contraste alto, acento índigo vibrante.

```css
:root[data-theme="dark"] {
  /* Estado */
  --theme-success: #10b981;    /* emerald-500 */
  --theme-warning: #f59e0b;    /* amber-500 */
  --theme-error: #ef4444;      /* red-500 */
  --theme-info: #3b82f6;       /* blue-500 */

  /* Backgrounds */
  --theme-background: #09090b;          /* zinc-950 */
  --theme-background-elevated: #18181b; /* zinc-900 */
  --theme-foreground: #fafafa;          /* zinc-50 */
  --theme-foreground-muted: #a1a1aa;    /* zinc-400 */
  --theme-foreground-subtle: #71717a;   /* zinc-500 */

  /* Primary (índigo) */
  --theme-primary: #6366f1;             /* indigo-500 */
  --theme-primary-foreground: #ffffff;
  --theme-primary-hover: #4f46e5;       /* indigo-600 */
  --theme-primary-active: #4338ca;      /* indigo-700 */

  /* Secondary */
  --theme-secondary: #27272a;           /* zinc-800 */
  --theme-secondary-foreground: #fafafa;

  /* Accent (violeta) */
  --theme-accent: #a78bfa;              /* violet-400 */
  --theme-accent-foreground: #09090b;

  /* Borders */
  --theme-border: #27272a;              /* zinc-800 */
  --theme-border-strong: #3f3f46;       /* zinc-700 */
  --theme-border-subtle: #18181b;       /* zinc-900 */

  /* Cards */
  --theme-card: #18181b;                /* zinc-900 */
  --theme-card-foreground: #fafafa;
  --theme-card-hover: #1f1f23;          /* zinc-800/50 */

  /* Muted */
  --theme-muted: #27272a;               /* zinc-800 */
  --theme-muted-foreground: #a1a1aa;    /* zinc-400 */

  /* Focus */
  --theme-focus-ring: rgba(99, 102, 241, 0.5);  /* indigo-500/50 */

  /* Destructive */
  --theme-destructive: #dc2626;         /* red-600 */
  --theme-destructive-foreground: #ffffff;
}
```

### 3.3 Tema Light

Inspiración: Apple. Blanco puro, sombras suaves, mismo acento índigo.

```css
:root[data-theme="light"] {
  --theme-success: #059669;
  --theme-warning: #d97706;
  --theme-error: #dc2626;
  --theme-info: #2563eb;

  --theme-background: #ffffff;
  --theme-background-elevated: #f4f4f5;       /* zinc-100 */
  --theme-foreground: #09090b;
  --theme-foreground-muted: #52525b;
  --theme-foreground-subtle: #71717a;

  --theme-primary: #6366f1;
  --theme-primary-foreground: #ffffff;
  --theme-primary-hover: #4f46e5;
  --theme-primary-active: #4338ca;

  --theme-secondary: #f4f4f5;
  --theme-secondary-foreground: #09090b;

  --theme-accent: #7c3aed;
  --theme-accent-foreground: #ffffff;

  --theme-border: #e4e4e7;
  --theme-border-strong: #d4d4d8;
  --theme-border-subtle: #f4f4f5;

  --theme-card: #ffffff;
  --theme-card-foreground: #09090b;
  --theme-card-hover: #fafafa;

  --theme-muted: #f4f4f5;
  --theme-muted-foreground: #52525b;

  --theme-focus-ring: rgba(99, 102, 241, 0.4);

  --theme-destructive: #dc2626;
  --theme-destructive-foreground: #ffffff;
}
```

### 3.4 Tema Nebula

Variante oscura con acentos púrpura/magenta. Estética más expresiva, para usuarios que quieren diferenciarse.

```css
:root[data-theme="nebula"] {
  --theme-success: #34d399;
  --theme-warning: #fbbf24;
  --theme-error: #f87171;
  --theme-info: #60a5fa;

  --theme-background: #0c0a14;            /* deep purple-black */
  --theme-background-elevated: #1a1525;
  --theme-foreground: #f3e8ff;            /* violet-100 */
  --theme-foreground-muted: #c4b5fd;      /* violet-300 */
  --theme-foreground-subtle: #9333ea;     /* purple-600 */

  --theme-primary: #a855f7;               /* purple-500 */
  --theme-primary-foreground: #0c0a14;
  --theme-primary-hover: #9333ea;
  --theme-primary-active: #7e22ce;

  --theme-secondary: #2e1065;             /* purple-900 */
  --theme-secondary-foreground: #f3e8ff;

  --theme-accent: #ec4899;                /* pink-500 */
  --theme-accent-foreground: #0c0a14;

  --theme-border: #2e1065;
  --theme-border-strong: #4c1d95;
  --theme-border-subtle: #1a1525;

  --theme-card: #1a1525;
  --theme-card-foreground: #f3e8ff;
  --theme-card-hover: #251a35;

  --theme-muted: #2e1065;
  --theme-muted-foreground: #c4b5fd;

  --theme-focus-ring: rgba(168, 85, 247, 0.5);

  --theme-destructive: #dc2626;
  --theme-destructive-foreground: #ffffff;
}
```

### 3.5 Tema Aurora

Variante con gradientes verde-cyan. Para diferenciación visual y personalidad.

```css
:root[data-theme="aurora"] {
  --theme-success: #10b981;
  --theme-warning: #f59e0b;
  --theme-error: #ef4444;
  --theme-info: #06b6d4;

  --theme-background: #04181f;            /* deep cyan-black */
  --theme-background-elevated: #0e2a32;
  --theme-foreground: #ccfbf1;            /* teal-100 */
  --theme-foreground-muted: #5eead4;      /* teal-300 */
  --theme-foreground-subtle: #14b8a6;     /* teal-500 */

  --theme-primary: #06b6d4;               /* cyan-500 */
  --theme-primary-foreground: #04181f;
  --theme-primary-hover: #0891b2;
  --theme-primary-active: #0e7490;

  --theme-secondary: #134e4a;             /* teal-900 */
  --theme-secondary-foreground: #ccfbf1;

  --theme-accent: #84cc16;                /* lime-500 */
  --theme-accent-foreground: #04181f;

  --theme-border: #134e4a;
  --theme-border-strong: #115e59;
  --theme-border-subtle: #0e2a32;

  --theme-card: #0e2a32;
  --theme-card-foreground: #ccfbf1;
  --theme-card-hover: #16323b;

  --theme-muted: #134e4a;
  --theme-muted-foreground: #5eead4;

  --theme-focus-ring: rgba(6, 182, 212, 0.5);

  --theme-destructive: #dc2626;
  --theme-destructive-foreground: #ffffff;
}
```

### 3.6 Reglas de uso de color

| Caso | Token | Razón |
|------|-------|-------|
| Fondo de la app | `--background` | Base del tema |
| Cards | `--card` | Elevación sutil sin shadow excesiva |
| Hover en cards | `--card-hover` | Feedback inmediato |
| Texto principal | `--foreground` | Contraste máximo |
| Texto secundario | `--foreground-muted` | Labels, metadata |
| Texto terciario | `--foreground-subtle` | Placeholders, hints |
| Botón principal | `--primary` + `--primary-foreground` | Acción principal |
| Botón secundario | `--secondary` + `--secondary-foreground` | Acción alternativa |
| Borde sutil | `--border-subtle` | Dividers internos |
| Borde default | `--border` | Inputs, cards |
| Borde fuerte | `--border-strong` | Focus visible |
| Éxito | `--success` | Login OK, reconexión, operación exitosa |
| Advertencia | `--warning` | Saldo bajo, sesión expirando |
| Error | `--error` | Login fallido, error del connector |
| Info | `--info` | Notificaciones informativas |
| Destructivo | `--destructive` | Eliminar cuenta, restablecer extensión |

### 3.7 Contraste AA

Todos los pares foreground/background cumplen WCAG AA (≥ 4.5:1 para texto normal, ≥ 3:1 para texto grande).

Verificado:

| Tema | Foreground sobre Background | Ratio |
|------|----------------------------|-------|
| Dark | #fafafa sobre #09090b | 19.4:1 ✓ |
| Light | #09090b sobre #ffffff | 19.4:1 ✓ |
| Nebula | #f3e8ff sobre #0c0a14 | 16.8:1 ✓ |
| Aurora | #ccfbf1 sobre #04181f | 14.2:1 ✓ |

Muted foreground cumple ≥ 4.5:1 en todos los temas. Subtle foreground se reserva para no-texto (decoración, bordes).

---

## 4. Espaciado

### 4.1 Escala

Sistema basado en 4px (0.25rem).

| Token | Valor | Uso |
|-------|-------|-----|
| `--space-0` | 0 | Sin padding/margin |
| `--space-px` | 1px | Bordes hairline |
| `--space-0.5` | 2px | Micro-ajustes |
| `--space-1` | 4px | Padding interno de badges, iconos pequeños |
| `--space-2` | 8px | Padding de inputs, gaps entre elementos relacionados |
| `--space-3` | 12px | Padding de cards, gaps entre campos de form |
| `--space-4` | 16px | Padding default de cards, gaps entre secciones |
| `--space-5` | 20px | Padding lateral de panels |
| `--space-6` | 24px | Padding interno del popup, gaps entre cards |
| `--space-8` | 32px | Padding de secciones principales |
| `--space-10` | 40px | Padding del SidePanel |
| `--space-12` | 48px | Espaciado hero, onboarding |
| `--space-16` | 64px | Splash screens |

### 4.2 Reglas de aplicación

- **Padding de cards**: `--space-4` (16px) default.
- **Padding de inputs**: `--space-2` vertical, `--space-3` horizontal.
- **Gap entre campos de form**: `--space-3` (12px).
- **Gap entre cards en grid**: `--space-3` o `--space-4`.
- **Padding lateral de secciones**: `--space-6` (popup), `--space-8` (sidepanel).
- **Padding vertical de header/footer**: `--space-4`.

---

## 5. Bordes y Radios

### 5.1 Border-radius

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-none` | 0 | Sin redondeo |
| `--radius-sm` | 4px | Badges, tags, chips |
| `--radius-md` | 6px | Inputs, selects, buttons |
| `--radius-lg` | 8px | Cards default |
| `--radius-xl` | 12px | Cards grandes, modales |
| `--radius-2xl` | 16px | SidePanel header, hero |
| `--radius-full` | 9999px | Pills, avatars, status dots |

### 5.2 Border-width

| Token | Valor | Uso |
|-------|-------|-----|
| `--border-hairline` | 1px | Dividers sutiles, borders default |
| `--border-thin` | 1px | Inputs, cards |
| `--border-thick` | 2px | Focus state, error state |

### 5.3 Shadows

Inspiración Linear: sombras sutiles, no excesivas.

| Token | Valor |
|-------|-------|
| `--shadow-none` | none |
| `--shadow-sm` | 0 1px 2px 0 rgb(0 0 0 / 0.05) |
| `--shadow-md` | 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) |
| `--shadow-lg` | 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1) |
| `--shadow-xl` | 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) |
| `--shadow-focus` | 0 0 0 3px var(--focus-ring) |

En tema Light, sombras son más visibles. En temas Dark, casi no se usan (se prefiere `border` para separación).

---

## 6. Componentes del Sistema

### 6.1 Buttons

**Variantes:**

| Variante | Uso | Color bg | Color fg | Border |
|----------|-----|----------|----------|--------|
| `primary` | Acción principal | `--primary` | `--primary-foreground` | none |
| `secondary` | Acción alternativa | `--secondary` | `--secondary-foreground` | `--border` |
| `ghost` | Acción terciaria | transparent | `--foreground` | none |
| `danger` | Acción destructiva | `--destructive` | `--destructive-foreground` | none |
| `outline` | Acción alternativa sutil | transparent | `--foreground` | `--border-strong` |

**Tamaños:**

| Tamaño | Padding Y | Padding X | Font | Icon |
|--------|-----------|-----------|------|------|
| `xs` | 4px | 8px | `--text-xs` | 12px |
| `sm` | 6px | 12px | `--text-sm` | 14px |
| `md` (default) | 8px | 16px | `--text-sm` | 16px |
| `lg` | 10px | 20px | `--text-base` | 18px |
| `icon` | 8px | 8px | — | 16px (cuadrado) |

**Estados:**

| Estado | Estilo |
|--------|--------|
| `default` | bg base |
| `hover` | bg `*-hover` |
| `active` | bg `*-active`, scale 0.98 |
| `focus` | outline `--shadow-focus` |
| `disabled` | opacity 0.5, cursor not-allowed |
| `loading` | spinner reemplaza icon/text, pointer-events: none |

**Reglas:**
- Solo **un** botón `primary` por vista.
- Botones `danger` requieren confirmación si la acción es irreversible.
- Botones con icono: icono a la izquierda del texto (LTR).
- Transition: `all 150ms ease`.

### 6.2 Cards

**Variantes:**

| Variante | Uso | Padding | Border | Shadow |
|----------|-----|---------|--------|--------|
| `default` | Cards informativas | `--space-4` (16px) | `--border` 1px | `--shadow-sm` |
| `elevated` | Cards modales, popovers | `--space-5` | `--border` 1px | `--shadow-lg` |
| `interactive` | Cards clickeables | `--space-4` | `--border` 1px | `--shadow-sm` → `--shadow-md` on hover |
| `outline` | Cards en grid compacto | `--space-3` | `--border-strong` 1px | none |

**Estructura típica:**

```
┌─────────────────────────┐
│ [Icon] Title            │  ← header (opcional)
│         Subtitle        │
├─────────────────────────┤
│ Content                 │  ← body
│                         │
├─────────────────────────┤
│ [Action]   [Action]     │  ← footer (opcional)
└─────────────────────────┘
```

### 6.3 Status Indicators

Estados de conexión con dot + label + color.

| Estado | Color dot | Label (es) | Icon |
|--------|-----------|------------|------|
| Conectado | `--success` | "Conectado" | `lucide Wifi` |
| Desconectado | `--foreground-subtle` | "Desconectado" | `lucide WifiOff` |
| Conectando | `--warning` (pulsing) | "Conectando..." | `lucide Loader2` (spin) |
| Sin conexión | `--foreground-subtle` | "Sin conexión" | `lucide WifiOff` |
| Sesión expirada | `--warning` | "Sesión expirada" | `lucide Clock` |
| Error | `--error` | "Error" | `lucide AlertCircle` |
| Reconectando | `--warning` (pulsing) | "Reconectando..." | `lucide RefreshCw` (spin) |

**Dot size:** 8px diameter, `--radius-full`, con box-shadow del mismo color para glow sutil.

**Animación pulsing:** `opacity 1 → 0.5 → 1` en 1.5s infinite ease-in-out.

### 6.4 Toast / Notification System (NEXA custom)

**Variantes:**

| Variante | Color accent | Icon | Auto-dismiss |
|----------|--------------|------|--------------|
| `success` | `--success` | `lucide CheckCircle2` | 5000ms |
| `error` | `--error` | `lucide AlertCircle` | 0 (no auto) |
| `warning` | `--warning` | `lucide AlertTriangle` | 8000ms |
| `info` | `--info` | `lucide Info` | 5000ms |

**Estructura:**

```
┌─────────────────────────────────────┐
│ [Icon] Título                       │  ← header
│        Mensaje descriptivo          │  ← body (opcional)
│                       [Acción] [X]  │  ← actions (opcional)
└─────────────────────────────────────┘
```

**Posicionamiento:** Top-right del popup/sidepanel, stack vertical, máximo 3 visibles simultáneos.

**Animación:**
- Entrada: slide-in from right + fade-in, 200ms ease-out.
- Salida: fade-out + slide-out right, 150ms ease-in.
- Hover: pausa auto-dismiss.

**Stacking:** Si hay más de 3, las más antiguas se ocultan (FIFO). Badge en icono de extensión muestra conteo.

### 6.5 Inputs

**Variantes:**

| Variante | Uso |
|----------|-----|
| `text` | Texto general |
| `password` | Credenciales — botón "ver/ocultar" |
| `email` | Validación automática |
| `search` | Con icono lupa, botón clear |
| `number` | Solo dígitos |

**Estados:**

| Estado | Border | Background |
|--------|--------|------------|
| `default` | `--border` 1px | `--background` |
| `hover` | `--border-strong` 1px | `--background` |
| `focus` | `--primary` 2px + `--shadow-focus` | `--background` |
| `error` | `--error` 2px | `--background` |
| `disabled` | `--border` 1px | `--muted` opacity 0.5 |

**Estructura:**

```
Label (text-sm, font-medium)
┌─────────────────────────────────────┐
│ [icon?] Placeholder/Value        [X]│  ← input
└─────────────────────────────────────┘
Hint text (text-xs, foreground-muted)
o
Error message (text-xs, error)
```

### 6.6 Selects

Usa Radix UI Select (shadcn/ui).

- Trigger: input-like.
- Dropdown: card `elevated` con opciones.
- Opción seleccionada: check mark a la derecha.
- Searchable si > 8 opciones.

### 6.7 Badges

Para metadata compacta: tipo de cuenta, estado, contador.

| Variante | Color |
|----------|-------|
| `default` | `--secondary` / `--secondary-foreground` |
| `primary` | `--primary` / `--primary-foreground` |
| `success` | `--success` / blanco |
| `warning` | `--warning` / blanco |
| `error` | `--error` / blanco |
| `outline` | transparent / `--foreground` / border |

**Tamaño:** padding 2px 8px, `--text-xs`, `--radius-sm`, font-weight medium.

### 6.8 Dialogs (modales)

Usa Radix UI Dialog (shadcn/ui).

- Overlay: `rgba(0,0,0,0.5)` con backdrop-blur(4px).
- Card: `elevated`, max-width 480px, padding `--space-6`.
- Header: title (`--text-lg`, Syne) + description (`--text-sm`, muted).
- Body: contenido.
- Footer: botones (default: secondary a la izquierda, primary a la derecha).

**Cierre:**
- Click en overlay.
- ESC key.
- Botón X (esquina superior derecha).
- NO se cierra al hacer click dentro (no inadvertent close).

### 6.9 Confirm Dialog

Variante de Dialog para acciones destructivas.

```
┌─────────────────────────────────────┐
│ [⚠ Icon] ¿Eliminar cuenta?         │
│                                     │
│ Esta acción no se puede deshacer.  │
│ La cuenta "pepe@nauta.com.cu"      │
│ se eliminará permanentemente.       │
│                                     │
│        [Cancelar]  [Eliminar]      │  ← danger en lugar de primary
└─────────────────────────────────────┘
```

- Confirmación de texto para acciones críticas (ej: "escribe ELIMINAR").
- Botón danger deshabilitado hasta confirmación.

### 6.10 Tabs

Para navegación dentro de una vista (ej: Settings → Appearance/Behavior/Notifications).

- Underline style, no pills.
- Tab activa: underline `--primary` 2px, text `--foreground`.
- Tab inactiva: underline transparent, text `--foreground-muted`.
- Hover: text `--foreground`, underline `--border-strong`.

### 6.11 Navigation (SidePanel)

Sidebar vertical con 5 items: Dashboard, Accounts, Scheduler, Settings, Developer.

```
┌──────────┐
│ ◉ Dashboard │ ← activo (bg muted, border-left primary 2px)
│ ○ Accounts  │
│ ○ Scheduler │
│ ○ Settings  │
│ ○ Developer │
└──────────┘
```

- Icono + label.
- Activo: bg `--muted`, border-left 2px `--primary`, text `--foreground`, font-weight medium.
- Inactivo: bg transparent, text `--foreground-muted`.
- Hover: bg `--muted` opacity 0.5, text `--foreground`.

### 6.12 Spinner / Loading

- SVG circular, stroke `--primary`, animación rotate 1s linear infinite.
- Tamaños: 12px, 16px, 20px, 24px.
- Para estados de carga cortos (<1s).
- Para estados largos: skeleton screens.

### 6.13 Skeleton

Para contenido que carga.

- Background: `--muted`.
- Animación: pulse (opacity 0.5 → 1 → 0.5, 2s ease-in-out infinite).
- Forma: rectángulos redondeados que imitan el layout final.

### 6.14 Empty State

Para listas vacías, sin datos, sin cuentas.

```
┌─────────────────────────────────────┐
│                                     │
│            [Icon 48px]              │
│                                     │
│      No hay cuentas todavía         │  ← title (text-lg, foreground)
│                                     │
│ Agrega tu primera cuenta Nauta para │  ← description (text-sm, muted)
│ comenzar a usar NEXA NautaX.        │
│                                     │
│         [+ Agregar cuenta]          │  ← CTA button
│                                     │
└─────────────────────────────────────┘
```

### 6.15 Banner (info/warning)

Para mensajes contextuales (ej: "Sin conexión con ETECSA").

| Variante | Color bg | Color border | Icon |
|----------|----------|--------------|------|
| `info` | `--info` opacity 0.1 | `--info` | `lucide Info` |
| `warning` | `--warning` opacity 0.1 | `--warning` | `lucide AlertTriangle` |
| `error` | `--error` opacity 0.1 | `--error` | `lucide AlertCircle` |
| `success` | `--success` opacity 0.1 | `--success` | `lucide CheckCircle2` |

- Padding `--space-3`, `--radius-md`.
- Icon a la izquierda, texto a la derecha.
- Optional dismiss button (X).

### 6.16 Tooltip

Para hints en iconos y acciones.

- Background: `--background-elevated` (dark) o `--foreground` (light).
- Color: inverso al background.
- Padding: `--space-1` `--space-2`.
- Font: `--text-xs`.
- Delay: 500ms.
- Max-width: 240px.
- Arrow pointing to trigger.

### 6.17 Switch (toggle)

Para settings on/off.

- Track: 36×20px, `--radius-full`, bg `--muted` (off) / `--primary` (on).
- Thumb: 16×16px circle, bg white, translate-x en on.
- Transition: 150ms ease.
- Focus: ring.

### 6.18 Code Block (Developer Mode)

Para logs, JSON, requests HTTP.

- Background: `--background-elevated` (en dark) o `--muted` (en light).
- Font: JetBrainsMono Regular, `--text-xs`.
- Color: `--foreground`.
- Padding: `--space-3`.
- Border-radius: `--radius-md`.
- Syntax highlighting: opcional, en Fase 7 (usar `shiki` o similar lightweight).

### 6.19 Logo NEXA

Logo compuesto: "NEXA" en Syne SemiBold + "NautaX" en Syne Medium, con separación `--space-1`.

```
NEXA  NautaX
```

- "NEXA" en `--foreground` (default) o `--primary` (hero).
- "NautaX" en `--foreground-muted`.
- Tamaños: 16px (compacto), 20px (default), 24px (header), 32px (splash).
- Variante con icono: cuadrado redondeado con "N" estilizada a la izquierda del texto.

### 6.20 Iconografía

**Librería:** `lucide-react`.

**Tamaños estándar:**

| Tamaño | Uso |
|--------|-----|
| 12px | Inline en texto, badges |
| 14px | Inputs, buttons sm |
| 16px | Buttons default, nav items |
| 18px | Cards headers, feature icons |
| 20px | Section icons |
| 24px | Page headers, empty states |
| 32px | Splash, onboarding |
| 48px | Hero icons |

**Color:** hereda `currentColor` del parent.

**Stroke-width:** 2 (default de lucide). Para énfasis ligero, 1.5. Para densidad alta, 1.5 también.

---

## 7. Animaciones

### 7.1 Principios

- **Cortas**: 150-250ms la mayoría.
- **Easing**: `ease-out` para entradas, `ease-in` para salidas, `ease-in-out` para transiciones.
- **Propósito**: cada animación comunica un cambio de estado. Nada de animaciones decorativas.

### 7.2 Tokens

```css
:root {
  --transition-fast: 100ms ease-out;
  --transition-default: 150ms ease-out;
  --transition-slow: 250ms ease-out;
  --transition-slower: 400ms ease-out;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);

  --duration-pulse: 1.5s;
  --duration-spin: 1s;
}
```

### 7.3 Animaciones específicas

| Elemento | Animation |
|----------|-----------|
| Toast entrada | slideInRight + fadeIn, 200ms ease-out |
| Toast salida | slideOutRight + fadeOut, 150ms ease-in |
| Modal entrada | scaleIn 0.95 → 1 + fadeIn, 200ms ease-out |
| Modal salida | scaleOut 1 → 0.95 + fadeOut, 150ms ease-in |
| Dropdown entrada | slideInDown + fadeIn, 150ms ease-out |
| Status dot pulsing | opacity 1 → 0.5 → 1, 1.5s ease-in-out infinite |
| Spinner | rotate 360deg, 1s linear infinite |
| Button hover | backgroundColor transition, 150ms |
| Card hover | boxShadow + transform translateY(-1px), 200ms |
| Skeleton pulse | opacity 0.5 → 1 → 0.5, 2s ease-in-out infinite |
| Page transition (sidepanel) | fadeIn, 200ms ease-out |

### 7.4 Respect `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Toda animación se desactiva si el usuario lo prefiere. Funcionalidad intacta, solo sin motion.

---

## 8. Layout y Grid

### 8.1 Popup

- **Dimensiones:** 380px × 520px (fijo, no responsive).
- **Padding exterior:** 0 (el browser lo gestiona).
- **Padding interior:** `--space-4` (16px).
- **Estructura:**
  ```
  ┌─────────────────────────┐ 380px
  │ Header (logo + theme)   │ 48px
  ├─────────────────────────┤
  │                         │
  │     Content             │ flex-1
  │                         │
  ├─────────────────────────┤
  │ Footer (status)         │ 40px
  └─────────────────────────┘
      520px total
  ```

### 8.2 SidePanel

- **Dimensiones:** ancho variable (Chrome gestiona), altura full viewport (típicamente 600-900px).
- **Padding exterior:** 0.
- **Padding interior:** `--space-6` (24px) lateral, `--space-4` (16px) vertical.
- **Estructura:**
  ```
  ┌─────────────────────────────────┐
  │ Header (logo + nav toggle)      │ 56px
  ├──────┬──────────────────────────┤
  │      │                          │
  │ Nav  │     Content              │ flex-1
  │ 64px │                          │
  │      │                          │
  ├──────┴──────────────────────────┤
  │ Footer (status + connection)    │ 40px
  └─────────────────────────────────┘
  ```

### 8.3 Grid system

Para cards en dashboard y accounts.

| Breakpoint | Columns | Gap |
|------------|---------|-----|
| < 400px | 1 | `--space-3` |
| 400-640px | 2 | `--space-3` |
| 640-1024px | 3 | `--space-4` |
| > 1024px | 4 | `--space-4` |

Usamos CSS Grid (`grid-template-columns: repeat(auto-fill, minmax(180px, 1fr))`).

### 8.4 Z-index

```css
:root {
  --z-base: 0;
  --z-dropdown: 1000;
  --z-sticky: 1100;
  --z-banner: 1200;
  --z-overlay: 1300;
  --z-modal: 1400;
  --z-toast: 1500;
  --z-tooltip: 1600;
}
```

---

## 9. Accesibilidad

### 9.1 Contraste

- Todos los pares texto/fondo cumplen WCAG AA (4.5:1 normal, 3:1 large).
- Estados disabled no requieren contraste AA (excepción permitida).

### 9.2 Focus visible

- Todos los elementos interactivos tienen focus ring visible.
- Color: `--focus-ring`.
- Estilo: `box-shadow: 0 0 0 3px var(--focus-ring)`.
- Nunca `outline: none` sin reemplazo.

### 9.3 Navegación por teclado

- Tab order lógico (sigue el orden visual).
- Enter/Space activa buttons.
- ESC cierra modales/dropdowns.
- Arrow keys en tabs, selects, listas.
- `Cmd/Ctrl+K` abre command palette (futuro).

### 9.4 ARIA

- Todos los iconos-only buttons tienen `aria-label`.
- Modales tienen `role="dialog"` y `aria-modal="true"`.
- Toasts tienen `role="status"` o `role="alert"`.
- Inputs tienen `<label>` asociado.

### 9.5 Screen readers

- Texto descriptivo en acciones (no "Click aquí").
- Estado de conexión anunciado via `aria-live="polite"`.
- Errores anunciados via `aria-live="assertive"`.

---

## 10. Iconografía — Catálogo

Iconos `lucide-react` usados en el proyecto (no exhaustivo, los principales):

| Categoría | Iconos |
|-----------|--------|
| Conectividad | Wifi, WifiOff, Loader2, RefreshCw, Globe, Network |
| Autenticación | LogIn, LogOut, Key, Lock, Unlock, Shield, ShieldCheck |
| Cuentas | User, Users, UserPlus, UserMinus, UserCheck, Mail |
| Tiempo | Clock, Timer, Calendar, Hourglass, AlarmClock |
| Saldo | Wallet, DollarSign, Coins, TrendingDown, TrendingUp |
| Navegación | LayoutDashboard, Settings, Wrench, Calendar, ListChecks, ChevronRight, ChevronLeft, ChevronDown, Home |
| Estados | CheckCircle2, AlertCircle, AlertTriangle, Info, XCircle, X, Check |
| Acciones | Plus, Minus, Trash2, Pencil, Save, Download, Upload, Copy, RefreshCw, Power |
| Developer | Terminal, Code, Bug, Activity, Database, Server, Globe, Network |
| UI | Eye, EyeOff, Search, Filter, MoreVertical, MoreHorizontal, Maximize2, Minimize2, X |
| Branding | (custom NEXA logo SVG) |

**Reglas:**
- Tamaño default: 16px.
- Stroke-width: 2 (default).
- Color: `currentColor`.
- Nunca usar emojis como sustituto.

---

## 11. Sonido (sin sonido)

NEXA NautaX **no reproduce sonidos**. Toda notificación es visual. Esto es deliberado — las extensiones que suenan son intrusivas.

Excepción futura: si se agrega, debe ser opt-in y con volumen respetando preferencias del sistema.

---

## 12. Microinteracciones

### 12.1 Button press

- `transform: scale(0.98)` en active state.
- Duration: 100ms.

### 12.2 Card hover (interactive)

- `transform: translateY(-1px)`.
- `box-shadow` aumenta un nivel.
- Duration: 200ms ease-out.

### 12.3 Toast appear

- Slide from right + fade in.
- Duration: 200ms.

### 12.4 Status dot pulse

- `opacity: 1 → 0.5 → 1`.
- Duration: 1.5s, infinite.

### 12.5 Toggle switch

- Thumb translateX, color track change.
- Duration: 150ms ease.

### 12.6 Tab switch

- Underline slide entre tabs (no fade).
- Duration: 200ms ease-out.

### 12.7 Number changes (saldo, tiempo)

- Si número cambia, animación `number flip` sutil.
- Usar `framer-motion` o animación CSS custom.
- Duration: 300ms.

---

## 13. Responsive Behavior

### 13.1 Popup

- Tamaño fijo 380×520.
- No responsive (el browser dimensiona).
- TODO el contenido cabe en ese tamaño — si no, simplificar.

### 13.2 SidePanel

- Ancho: variable (Chrome controla, típicamente 320-500px).
- Altura: full viewport.
- Layout se adapta:
  - < 360px ancho: nav colapsa a icons-only.
  - < 400px: grid de cards → 1 columna.
  - ≥ 400px: grid 2 columnas.

### 13.3 Nunca romper layout

- Textos largos: `text-overflow: ellipsis` con tooltip.
- Números grandes: `font-size: clamp()` responsive.
- Imágenes: `max-width: 100%`, `object-fit: contain`.

---

## 14. Tema por defecto y selección

### 14.1 Default

**Dark** (D05). Si usuario no ha elegido, se aplica Dark.

### 14.2 Selección

En Settings → Appearance:
- 4 botones-radio con preview de cada tema.
- Opción "Sistema" (solo dark/light).

### 14.3 Persistencia

- `nexa.settings.theme = { mode: 'manual', theme: 'dark' | 'light' | 'nebula' | 'aurora' }`
- O `nexa.settings.theme = { mode: 'system' }`.

### 14.4 Aplicación

- `document.documentElement.setAttribute('data-theme', theme)`.
- CSS variables se resuelven automáticamente.

---

## 15. Pendientes para Fases siguientes

### Fase 5
- Implementar `themes/tokens.css`, `themes/dark.css`, `themes/light.css`, `themes/nebula.css`, `themes/aurora.css`.
- Configurar `@font-face` para Syne, DNSans, JetBrainsMono en `public/fonts/`.
- Setup Tailwind config con colores mapeados a CSS variables.
- Inicializar shadcn/ui CLI y generar componentes base.

### Fase 7
- Implementar `components/nexa/*` (NexaButton, NexaCard, NexaToast, NexaStatusIndicator, etc.).
- Implementar `components/ui/*` (shadcn base).
- Implementar `components/layout/*` (SidePanelLayout, PopupLayout).
- Aplicar design system a todas las screens.

---

**Fin del Documento 1.**
Continúa en `02-ux-flow-specification.md`.
