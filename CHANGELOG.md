# Historial de cambios

Todos los cambios relevantes de LensDesk se documentan aquí.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el proyecto usa
[versionado semántico](https://semver.org/lang/es/).

## [Sin publicar]

## [0.5.0] - 2026-11-04

Preparación de la publicación: LensDesk y sus herramientas pueden actualizarse por separado.

### Para actualizar

- Instala LensDesk 0.5.0 y, por separado, los paquetes nuevos de Notas y Convertidor 0.4.1 para
  recibir sus componentes de interfaz actualizados. Actualizar solo LensDesk no modifica las
  herramientas instaladas. Los datos se conservan.

### Añadido

- Consulta independiente de la release de LensDesk y del catálogo oficial de herramientas, con
  resultados por fuente, conservación de resultados anteriores cuando falla una consulta y
  reconciliación local al instalar o quitar herramientas sin repetir peticiones.
- Selección de la mayor versión compatible para cada herramienta instalada, con aviso separado
  si existe una posterior incompatible. Navegación desde el recuento a Herramientas con foco y
  resultados conservados al volver a Ajustes.
- Publicación genérica por tags de herramienta, validación de paquetes y metadatos antes de
  publicar, reanudación idempotente y catálogo completo con despliegue protegido mediante Pages.
  Requiere configuración inicial del mantenedor; esta preparación no implica despliegue.

### Cambiado

- Las releases de app adjuntan copias de paquetes oficiales firmados compatibles con host 0.4.0
  y API 1 para clientes antiguos; no vuelven a construir ni firmar herramientas.
- Indicador vectorial compartido en los selectores de LensDesk y Notas: orientación visible al
  abrir/cerrar, teclado, foco y movimiento reducido. Disponible por defecto para herramientas
  que reutilicen `@lensdesk/ui`.
- Versiones independientes: app y empaquetador 0.5.0, UI y herramientas recompiladas 0.4.1;
  SDK 0.4.0/API 1 sin cambios y plantilla inicial 0.1.0.

### Corregido

- Quitar una herramienta desde Herramientas conserva esa página, sus tarjetas o estado vacío y
  un foco válido, incluso si hay otras pestañas activas o la herramienta quitada no tenía pestaña.
- Los fallos parciales de actualización no se presentan como éxito ni eliminan resultados
  válidos de la otra fuente; una comprobación autoritativa sin novedades limpia avisos anteriores.

## [0.4.0] - 2026-11-03

Mejoras de accesibilidad, lectura y respuesta de la interfaz en Ajustes, Notas y el Convertidor.

### Para actualizar

- Reinstala **Notas** y el **Convertidor** con los `.lenspkg` de esta versión para recibir las
  mejoras de las herramientas. Tus notas y ajustes se mantienen.

### Añadido

- Ajustes: estados de carga y guardado, mensajes de error junto a la acción y opción para
  reintentar sin bloquear los demás controles.
- Notas: indicador de autoguardado del cuerpo de cada nota, con estados pendiente, guardando,
  guardado y error, y reintento del borrador conservado cuando falla la escritura.
- Convertidor: resumen de los archivos guardados al completar, cancelar o fallar «Guardar
  todos».

### Cambiado

- Nombres, descripciones y anuncios para lectores de pantalla en los controles de Ajustes,
  las notas privadas, los campos de credenciales y los estados del Convertidor.
- Lectura de Markdown, colores de código, foco y estados de las tarjetas con estilos
  compartidos; adaptación de diálogos y nombres largos en ventanas estrechas.
- Pruebas de interfaz ampliadas para los estados de error, reintento, privacidad, movimiento
  reducido y ventanas compactas en macOS y Windows.

### Corregido

- Notas: los fallos de copia se comunican y permiten reintentar; los errores de autoguardado
  conservan el borrador para recuperarlo.
- Notas: al convertir una nota en privada se esperan las escrituras públicas pendientes y se
  descartan sus respuestas obsoletas para evitar sobrescribir el contenido más reciente.
- Convertidor: cancelar un diálogo de «Guardar todos» detiene el lote, conserva los archivos
  ya escritos e informa cuántos se guardaron; un error de escritura también detiene el lote.
- Pruebas de interfaz: obtención del nombre de archivo compatible con Windows y sincronización
  con los estados y las transiciones observables de la aplicación.

## [0.3.0] - 2026-10-26

Mejoras visuales y de funcionamiento: pestañas, ventana, actualizaciones y Notas.

### Para actualizar

- Reinstala **Notas** y el **Convertidor** con los `.lenspkg` de esta versión para recibir el
  diseño nuevo y sus funciones: las herramientas instaladas conservan la versión anterior hasta
  que las reinstalas. Tus notas y ajustes se mantienen.

### Añadido

- Pestañas: reordenar arrastrando o con Ctrl+Mayús+← / →, cerrar con la × al pasar el ratón, con
  clic central o con ⌘W / Ctrl+W, y un máximo de seis abiertas: al abrir la séptima se cierra la
  menos usada con un aviso que permite deshacerlo.
- Ventana: tamaño mínimo de 760 × 520 con diseño adaptable, una sola instancia de LensDesk y
  opción para abrirlo al iniciar sesión.
- Actualizaciones: buscar desde Ajustes, aviso en la cabecera que lleva a Ajustes y, para LensDesk
  y sus herramientas, dos pasos: «Descargar» abre el archivo en el navegador e «Instalar archivo…»
  lo instala. LensDesk sigue sin descargar nada por su cuenta.
- Notas: título propio editable, deshacer y rehacer, formato del texto seleccionado, menú de clic
  derecho con formato e insertar, copiar la nota y los bloques de código, sugerencias de
  ortografía en macOS, notas archivadas, lista plegable en ventanas estrechas y una nota de guía
  de Markdown la primera vez.
- Notas privadas: cifradas en el equipo, con contraseña y preguntas de recuperación, bloqueo tras
  10 intentos fallidos y bloque de credenciales con campos y botón de copiar.
- Convertidor: borrar el historial y marca en los archivos ya guardados.
- Transiciones suaves en pestañas, avisos, menús, interruptores y botones; ninguna con
  «reducir movimiento».
- SDK: `onSpelling` y `onVisibilityChange` opcionales y la opción `spellcheck`. La API v1 solo
  crece.

### Cambiado

- Medidas, colores y espaciado de Herramientas, Ajustes, Notas y el Convertidor ajustados al
  diseño aprobado; menús con filas de 32 px y atajos a la derecha.
- Los avisos se colocan junto a Herramientas y Ajustes y se apilan cuando hay más de uno.
- Textos con tono neutro en LensDesk y en las herramientas.
- El contorno de foco solo aparece al usar el teclado, no al hacer clic.

### Corregido

- Al arrancar varias veces a la vez, una herramienta podía iniciar más de un proceso.
- Con un aviso en la cabecera, la interfaz podía quedarse redibujando hasta mostrar «LensDesk
  encontró un problema».
- En Windows con la ventana al mínimo, el aviso podía tapar el botón Herramientas.
- La barra «Convirtiendo» del Convertidor alargaba un instante la lista al desaparecer.

## [0.2.0] - 2026-10-20

Diseño nuevo para LensDesk y sus herramientas.

### Para actualizar

- Reinstala **Notas** y el **Convertidor** con los `.lenspkg` de esta versión para ver el diseño
  nuevo: las herramientas instaladas conservan su aspecto anterior hasta que las reinstalas. Tus
  notas y ajustes se mantienen.

### Añadido

- Barra de título integrada con los botones del sistema en macOS y Windows; en pantalla completa
  de macOS la cabecera muestra «LensSystems - LensDesk».
- Color de acento azul o verde en Ajustes → Apariencia, aplicado al momento en LensDesk y en las
  herramientas abiertas.
- Icono de la aplicación y logotipo nuevos, y sección «Acerca de» en Ajustes.
- Notas: resaltado de lo encontrado al buscar, extracto de cada nota en la lista, coloreado de
  Markdown y números de línea en el editor.
- Paquete `@lensdesk/ui` con los componentes que comparten LensDesk y las herramientas, y una
  galería para verlos (`pnpm ui:gallery`).
- SDK: campo opcional `accent` en el contexto de la herramienta y código de error
  `E_PACKAGE_INVALID` para paquetes dañados o que no son `.lenspkg`. La API v1 solo crece.

### Cambiado

- Estilo «Lienzo»: paleta Pizarra en oscuro y neutros fríos en claro, letra Manrope, cabecera de
  52 px con pestañas centradas y paneles redondeados.
- Página Herramientas con tarjetas; Ajustes organizados por secciones.
- Los diálogos de una herramienta muestran sus permisos, su firma y el código de error.
- Notas y el Convertidor a dos paneles; la cola del Convertidor muestra cada estado en su tarjeta.
- Pantallas de recuperación con icono y botón principal.

### Corregido

- Accesibilidad: foco visible en todos los controles, lectores de pantalla sin nombres repetidos
  en los botones de icono, título de ventana en las herramientas, nombre del editor de Notas y
  avisos de estado en la cola del Convertidor.
- Los títulos de nota y los nombres de archivo largos ya no ocultan botones ni ensanchan la lista.
- Las herramientas usaban la letra del sistema en lugar de la incluida.
- El estado de pantalla completa se mantiene al recargar la ventana.
- Al actualizar una herramienta con su pestaña abierta, la pestaña se recarga con la versión
  nueva; antes seguía mostrando la anterior hasta reiniciar LensDesk.
- Notas: con el backend lento, una nota recién creada podía desaparecer de la lista y la Papelera
  podía mostrarse vacía justo después de mover una nota a ella.
- Sin empaquetar (`pnpm dev`), LensDesk no encontraba las claves de firma y rechazaba los paquetes
  firmados.

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

[Sin publicar]: https://github.com/LensSystems/LensDesk/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/LensSystems/LensDesk/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/LensSystems/LensDesk/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/LensSystems/LensDesk/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/LensSystems/LensDesk/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/LensSystems/LensDesk/releases/tag/v0.1.0
