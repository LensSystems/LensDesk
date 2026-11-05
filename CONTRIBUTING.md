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

- **Datos 100 % locales.** No se añade contenido remoto ni red en las herramientas. Solo el host
  consulta los dos endpoints fijos de metadatos de actualización documentados en el
  [README](README.md#privacidad-y-seguridad); no envía datos ni inventarios de herramientas.
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
Para controles de selección, usa el [selector compartido](README.md#selectores-compartidos)
de `@lensdesk/ui` sin copiar su indicador. Comprueba normal/hover/foco, disabled/error,
valores largos y teclado en la galería. La plantilla hereda el idioma del host.

## Versiones y publicaciones independientes

La app, las herramientas y los paquetes internos tienen versiones propias. La raíz y
`apps/desktop/package.json` deben coincidir. En cada herramienta, `package.json` y
`lensdesk.tool.json` deben coincidir; usa versiones estables canónicas `X.Y.Z` para publicar.
No alinees todas las versiones ni aumentes `minHostVersion` sin una necesidad de compatibilidad.
El SDK sigue en API 1: los cambios deben ser aditivos. `@lensdesk/ui` va dentro del paquete de
cada herramienta; si sus bytes cambian al recompilar, publica una versión nueva de esa herramienta.
Actualizar solo la app no cambia componentes embebidos en herramientas ya instaladas.

### Preparación remota por el mantenedor

Estos pasos son acciones del mantenedor en GitHub, no efectos de ejecutar los comandos locales.
Deben completarse después de integrar los workflows en `main` y antes de crear tags de app:

1. Reserva exclusivamente `https://lenssystems.github.io/LensDesk/` para el catálogo del repositorio
   `LensSystems/LensDesk`. Comprueba que no aloja otro contenido y que no hay dominio personalizado
   (`CNAME`). En **Settings → Pages**, elige **GitHub Actions** como fuente. El workflow no habilita
   Pages ni sustituye un sitio existente: verifica URL, propiedad y marcador antes de desplegar.
2. Configura el environment protegido `tool-releases`, sus revisores y el secreto de firma
   `LENSPKG_SIGNING_KEY` correspondiente a `apps/desktop/resources/keys/release.pub`. La clave
   privada se utiliza solo en CI tras pasar las comprobaciones; nunca se copia al repositorio,
   ejemplos, fixtures o capturas.
3. Configura `github-pages` con protección y revisión de despliegues para `main` y los patrones
   de tags `v[0-9]*.[0-9]*.[0-9]*` y `*-v[0-9]*.[0-9]*.[0-9]*`. El workflow valida estrictamente el
   tag y su integración en `main`. Un reusable conserva el ref y OIDC del caller: hacer checkout
   de `main` no convierte un despliegue desde tag en uno desde rama. No permitas refs arbitrarios
   para evitar esta protección.
4. Solo si el destino está vacío y reservado, ejecuta manualmente **Tools catalog** desde `main`
   con `initialize_catalog: true`. Esto confirma el destino, no habilita Pages. Si existe otro
   contenido o falta la configuración previa, se aborta. Las llamadas automáticas no inicializan.
5. Antes de un tag de app, comprueba por GET público el esquema de
   `https://lenssystems.github.io/LensDesk/tools-catalog-v1.json` y el marcador
   `lensdesk-tools-catalog-site.json`. Contrasta los dos paquetes bootstrap de `v0.4.0` con los
   hashes originales fijados en `packages/lenspkg/src/catalog-building/bootstrap.ts` y sus firmas.
   No recrees `notes-v0.4.0` ni `md-converter-v0.4.0`: esas identidades están reservadas a los
   bytes originales de la release de app `v0.4.0`.

Para reconstruir o recuperar un catálogo ya inicializado, ejecuta **Tools catalog** desde `main`
con `initialize_catalog: false`. Se enumeran todas las releases y se verifican metadatos,
paquetes, firmas y hashes antes de desplegar; un fallo no publica un índice parcial. No se
vuelven a firmar ni publicar paquetes. La exclusión global cubre enumeración, generación y deploy,
sin cancelar el trabajo en curso. Los callers de app y herramienta lo invocan tras publicar;
se exige que la release disparadora ya sea pública y estable en la enumeración. Pages contiene
solo JSON y archivos pequeños de identificación, sin paquetes ni código privado.

### Publicar una herramienta

1. Sigue [Crear una herramienta](README.md#crear-una-herramienta): ID único, manifiesto y package
   coherentes, locales es/en, permisos mínimos, `apiVersion: 1` y `minHostVersion` real. La
   plantilla es un ejemplo inicial 0.1.0 y se excluye de publicaciones automáticas.
2. Construye la herramienta seleccionada, prueba backend e interfaz y ejecuta las comprobaciones
   anteriores. Desde la raíz puedes validar el bundle con una clave efímera sin red ni un tag real:

   ```bash
   pnpm --dir tools/<directorio> build
   node packages/lenspkg/src/tool-release-cli.ts dry-run <id>-v<versión>
   ```

   El ID del tag corresponde al manifiesto, no necesariamente al nombre de la carpeta. El comando
   no publica y no utiliza la clave de release. Prueba el paquete local sin firma en modo
   desarrollador; verifica también firma/contenido mediante los fixtures de las pruebas.
3. Actualiza su versión en package/manifiesto y describe el cambio. Integra código, metadatos y
   workflows en `main`, con CI correcta, antes de que el mantenedor cree y suba el tag
   `<id>-vX.Y.Z` (por ejemplo, para la siguiente publicación real de Notas, `notes-v0.4.1`).
   No crees releases ficticias para probar el catálogo ni cambies un ID/versión ya publicado.
4. **Release tool** descubre el manifiesto dentro de `tools/` sin una lista fija. Valida
   tag/ID/version/API/minHost, compila y prueba en macOS y Windows, y firma solo la seleccionada
   después de esas compuertas. No genera instaladores de LensDesk.
5. La publicación verifica el paquete, crea un draft, valida sus assets y lo hace público con
   `make_latest: false`: solo `<id>-<versión>.lenspkg`, `tool-release.json` y `SHA256SUMS.txt`.
   Reanudar bytes idénticos es idempotente; un conflicto aborta y no se sobrescribe. A continuación
   se reconstruye el catálogo completo. Una herramienta nueva no requiere editar el workflow.
6. El usuario descarga el `.lenspkg` firmado y lo instala desde LensDesk. El catálogo es
   informativo y sin firma propia; el instalador mantiene la verificación Ed25519 y SHA-256.

### Publicar LensDesk

1. Actualiza raíz y `apps/desktop/package.json`, `CHANGELOG.md` y documentación de lo implementado.
   Comprueba la preparación remota del catálogo y las pruebas en ambos sistemas.
2. Comprueba localmente `node scripts/check-app-release.ts vX.Y.Z` (sin crear un tag). El
   workflow de app comprueba tag y versiones antes de instalar dependencias o compilar; los
   tags de herramientas usan su validación independiente. Tras integrar en `main`, el
   mantenedor crea y sube `vX.Y.Z`. La release de app sigue siendo
   Latest; los tags de herramientas no activan este workflow.
3. **Release** compila los instaladores y adjunta snapshots: como máximo un paquete oficial por
   ID, la mayor versión compatible con **host 0.4.0 y API 1**, conservando los bytes firmados
   originales. Omite IDs sin candidato compatible. No reconstruye ni firma herramientas y no
   garantiza que el snapshot sea su última versión. No son herramientas preinstaladas.
4. Se publican instaladores, snapshots y `SHA256SUMS.txt`; después se reconstruye el catálogo.
   Los clientes modernos usan todas las candidatas del catálogo para elegir la mayor compatible
   e informar aparte de una posterior incompatible. Los clientes 0.4 dependen de los snapshots.

La primera publicación real de una herramienta nueva debe corresponder a un cambio integrado y
validado. Preparar estos archivos no acredita CI remota, despliegue, publicación ni pruebas manuales.

## Licencia

Al contribuir aceptas que tu aporte se distribuya bajo la [licencia MIT](LICENSE) del proyecto.
