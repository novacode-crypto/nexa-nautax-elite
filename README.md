# NEXA NautaX

Extensión Chromium premium para administración de cuentas Nauta ETECSA.

## Estado del proyecto

🚧 En desarrollo — Fase 5: Implementación del Núcleo.

## Stack

- Manifest V3 (Service Worker, SidePanel, Offscreen API)
- React 18 + TypeScript 5.5 (strict)
- Vite 5 + @crxjs/vite-plugin
- Tailwind CSS 3.4 + shadcn/ui
- Zustand 4.5
- Zod 3
- Vitest + Testing Library

## Estructura

Ver `docs/architecture/` para la documentación completa por fase.

## Desarrollo

```bash
pnpm install
pnpm dev
```

Cargar extensión en Chrome:
1. Abrir `chrome://extensions`
2. Activar "Modo desarrollador"
3. "Cargar descomprimida" → seleccionar `dist/`

## Licencia

MIT — ver [LICENSE](LICENSE).

## Privacidad

Ver [PRIVACY.md](PRIVACY.md).
