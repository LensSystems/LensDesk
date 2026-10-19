# Cómo contribuir a LensDesk

Gracias por tu interés. Esta guía resume cómo preparar el entorno, las reglas del proyecto y el
flujo para proponer cambios.

## Entorno

- **Node:** la versión de `.nvmrc`.
- **pnpm:** la versión del campo `packageManager` de `package.json` (con Corepack:
  `corepack enable`). El proyecto usa solo pnpm.
- macOS o Windows para ejecutar la aplicación.

```bash
pnpm install
pnpm dev                                  # LensDesk en modo desarrollo
LENSDESK_DEV_TOOLS_DIR=tools pnpm dev     # con las herramientas del repositorio sin instalar
```

## Antes de abrir un pull request

Todo esto debe pasar; la CI lo ejecuta en macOS y en Windows:

```bash
pnpm format       # formatea y ordena imports
pnpm lint         # falla también con advertencias
pnpm typecheck
pnpm test
pnpm build && pnpm tools:package && pnpm test:e2e
pnpm smoke DB FTS5_MAIN FTS5_UTILITY TOOLS
```

Si cambias algo visible, incluye una captura y los pasos para probarlo a mano en macOS y Windows.

## Reglas del proyecto

- **100 % local.** No se añade ninguna petición de red ni contenido remoto. La única permitida es
  el aviso de versión nueva.
- **Las herramientas están aisladas.** Una herramienta nunca recibe ni envía una ruta de archivo
  ni alcanza los datos de otra.
- **Se valida en el borde.** Todo mensaje IPC y todo parámetro de backend pasa por un esquema zod.
- **Errores tipados:** `{ ok: true, data } | { ok: false, error: { code, message } }` entre
  procesos y `LensError(code, message)` dentro de uno. Los códigos (`E_…`) viven en
  `packages/sdk/src/errors.ts` y nunca cambian una vez publicados.
- **La API v1 del SDK solo crece.** Se pueden añadir métodos, campos opcionales y códigos de
  error; nunca quitar ni cambiar lo existente. `packages/sdk/src/contract.test.ts` fija la
  superficie pública.
- **Migraciones solo hacia adelante.** Nunca se edita una migración ya publicada.
- **Textos en los dos idiomas.** Toda cadena visible va en `locales/es.json` y `locales/en.json`.
- **TypeScript estricto, solo sintaxis borrable:** sin `enum` ni `namespace`, `import type` para
  tipos e imports relativos con extensión (`./archivo.ts`).
- **Un componente por archivo,** de 200 líneas como máximo; un módulo del proceso principal, de 300.
- **Diseño:** LensDesk y las herramientas usan los componentes de `packages/ui` (`@lensdesk/ui`;
  galería con `pnpm ui:gallery`), y estos usan los tokens de `packages/sdk/src/theme.css`, nunca
  colores sueltos.
- **Sin dependencias nuevas** sin hablarlo antes en un issue.
- Nunca subas claves privadas ni salidas de compilación (`out/`, `dist/`, `release/`).

## Flujo

1. Abre un issue para hablar de cambios grandes antes de programarlos.
2. Crea una rama desde `main` con un prefijo: `feature/`, `fix/` o `docs/`.
3. Haz commits pequeños con el formato `<tipo>(<zona>): <qué se hizo>`, en español y en
   imperativo. Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. Ejemplo:
   `fix(notes): conservar el texto al cambiar de nota`.
4. Abre el pull request contra `main` con la descripción del cambio y cómo lo probaste.

## Crear una herramienta

Sigue la sección **Crear una herramienta** del [README](README.md#crear-una-herramienta). Una
herramienta nueva incluye pruebas de su backend y de su interfaz, y sus textos en los dos idiomas.

## Publicar una versión

1. Actualiza `CHANGELOG.md` y la versión en los `package.json`.
2. Crea y sube la etiqueta `vX.Y.Z` (solo esa): `git tag vX.Y.Z && git push origin vX.Y.Z`.
3. El workflow de publicación compila los instaladores, firma las herramientas con el secreto
   `LENSPKG_SIGNING_KEY` y publica la versión con `SHA256SUMS.txt`.

## Licencia

Al contribuir aceptas que tu aporte se distribuya bajo la [licencia MIT](LICENSE) del proyecto.
