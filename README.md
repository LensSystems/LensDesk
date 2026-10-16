# LensDesk

LensDesk es una aplicación de escritorio local y modular para herramientas de desarrollo. Cada
herramienta se abre en su propia pestaña y se instala desde un paquete `.lenspkg`.

## Primer arranque

Las versiones distribuidas no están firmadas. En macOS, intenta abrir LensDesk una vez y después
ve a **Ajustes del Sistema → Privacidad y seguridad → Abrir de todos modos**. También puedes quitar
la marca de cuarentena con:

```bash
xattr -dr com.apple.quarantine /Applications/LensDesk.app
```

En Windows, cuando aparezca SmartScreen, selecciona **Más información** y después
**Ejecutar de todas formas**.

## Instalar una herramienta

En LensDesk, pulsa **Agregar herramienta…** y elige el archivo `.lenspkg` que quieras instalar.

## Crear una herramienta

Usa [`tools/_template`](tools/_template) como punto de partida:

1. Copia la carpeta a `tools/<tu-herramienta>`.
2. Cambia `id` y `name` en `lensdesk.tool.json`, y `name` en `package.json`.
3. Ejecuta `pnpm install` y genera el paquete con
   `pnpm --filter <nombre-del-paquete> run package`.
4. Instala el `.lenspkg` de `dist/` con **Agregar herramienta…**. Sin firma, activa antes el modo
   desarrollador en Ajustes.

## Desarrollo

Requisitos: Node indicado en `.nvmrc` y pnpm indicado en `package.json`.

```bash
pnpm install
pnpm dev
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```

# LensDesk (English)

LensDesk is a local, modular desktop app for developer tools. Each tool opens in its own tab and is
installed from a `.lenspkg` package.

## First launch

Distributed builds are unsigned. On macOS, try opening LensDesk once, then go to **System Settings
→ Privacy & Security → Open Anyway**. You can also remove the quarantine flag with:

```bash
xattr -dr com.apple.quarantine /Applications/LensDesk.app
```

On Windows, when SmartScreen appears, select **More info**, then **Run anyway**.

## Install a tool

In LensDesk, click **Add Tool…** and choose the `.lenspkg` file you want to install.

## Create a tool

Use [`tools/_template`](tools/_template) as the starting point:

1. Copy the folder to `tools/<your-tool>`.
2. Change `id` and `name` in `lensdesk.tool.json`, and `name` in `package.json`.
3. Run `pnpm install` and build the package with
   `pnpm --filter <package-name> run package`.
4. Install the `.lenspkg` from `dist/` with **Add Tool…**. Unsigned packages need developer mode
   turned on in Settings first.

## Development

Requirements: Node from `.nvmrc` and pnpm from `package.json`.

```bash
pnpm install
pnpm dev
pnpm format
pnpm lint
pnpm typecheck
pnpm test
```
