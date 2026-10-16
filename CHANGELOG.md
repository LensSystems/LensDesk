# Historial de cambios

Todos los cambios relevantes de LensDesk se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

## [0.1.0] - 2026-10-16

Primera versión pública.

### Añadido

- Aplicación de escritorio para macOS (Apple Silicon e Intel) y Windows x64 con pestañas de
  herramientas, página Herramientas y Ajustes.
- Instalación de herramientas desde paquetes `.lenspkg` con firma Ed25519 y hash SHA-256 por
  archivo; paquetes sin firma solo con el modo desarrollador y la insignia «sin firmar».
- Aislamiento por herramienta: vista con sandbox, sesión y carpeta de datos propias, backend en
  un proceso aparte, permisos `storage`, `files` y `backend`, y acceso a archivos sin rutas.
- SDK de herramientas (API v1): `createToolClient()`, `defineBackend()`, manifiesto, códigos de
  error y estilos compartidos.
- CLI de `.lenspkg` para generar claves, empaquetar, verificar e inspeccionar paquetes.
- Herramienta **Notas**: editor Markdown, vista previa, búsqueda de texto completo, notas fijadas,
  papelera, e importación y exportación de `.md`.
- Herramienta **Convertidor**: HTML, DOCX, CSV, PDF y XLSX a Markdown, con cola, progreso,
  cancelación y guardado de uno o de todos los resultados.
- Plantilla `tools/_template` para crear herramientas.
- Interfaz en español e inglés, temas claro, oscuro y del sistema, y atajos de teclado.
- Recuperación ante fallos: pantalla para recargar LensDesk y para reabrir una herramienta caída.
- Aviso de versión nueva (como mucho una vez al día, desactivable) y exportación de registros.
- Instaladores `.dmg`, `.zip` y `.exe` publicados por la CI con `SHA256SUMS.txt` y las
  herramientas firmadas.

[Sin publicar]: https://github.com/LensSystems/LensDesk/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/LensSystems/LensDesk/releases/tag/v0.1.0
