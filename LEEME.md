# NEXA NautaX — Patch Accounts CRUD

## Qué incluye

1. **AccountFormDialog** — modal para crear/editar cuenta (alias, usuario+dominio, contraseña, reconexión auto)
2. **AccountDeleteDialog** — confirmación de eliminación con info de la cuenta
3. **AccountList** — lista real de cuentas con avatar, editar, eliminar, seleccionar
4. **accountStore** — actualizado con método `update`
5. **messageClient** — actualizado con `accountUpdate`
6. **service-worker** — actualizado con handler `ACCOUNT_UPDATE`

## Cómo aplicar

```powershell
# 1. Extraer el ZIP
# 2. Copiar sobreescribiendo
xcopy /E /Y "ruta\del\zip\extraido\src\*" "D:\Z\nexa-nautax\src\"

# 3. Recompilar
cd D:\Z\nexa-nautax
npm run build

# 4. Recargar extensión
# chrome://extensions/ → Recargar NEXA NautaX
```

## Qué verás

### SidePanel → Cuentas

- Si no hay cuentas: empty state con botón "Agregar cuenta"
- Si hay cuentas: lista de cards con:
  - Avatar (inicial del alias, color hash)
  - Alias + check verde si está seleccionada
  - username@domain
  - Último uso (tiempo relativo)
  - Botón ⋯ con menú: Editar / Eliminar
- Botón "Agregar" arriba a la derecha

### Crear cuenta

1. Click "Agregar" → modal con:
   - Alias (texto libre)
   - Usuario + selector de dominio (@nauta.com.cu / @nauta.co.cu)
   - Contraseña + confirmar + strength meter
   - Checkbox reconexión automática
2. Click "Crear cuenta" → se guarda cifrada con AES-256
3. La lista se actualiza automáticamente

### Editar cuenta

1. Click ⋯ → Editar → mismo modal con datos cargados
2. Si no cambias la contraseña, se mantiene la actual
3. Click "Guardar cambios"

### Eliminar cuenta

1. Click ⋯ → Eliminar → modal de confirmación
2. Muestra info de la cuenta + advertencia
3. Click "Eliminar" → se borra permanentemente

### Seleccionar cuenta

- Click en cualquier card de cuenta → se marca como activa (check verde)
- Esta es la cuenta que se usará al conectar desde el popup
