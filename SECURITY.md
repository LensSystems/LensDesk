# Política de seguridad

## Versiones con soporte

Las correcciones de seguridad se publican solo en la última versión.

## Cómo reportar una vulnerabilidad

**No abras un issue público.** Usa el reporte privado de GitHub: pestaña **Security → Report a
vulnerability** de este repositorio.

Incluye:

- qué puede hacer quien aproveche el fallo;
- los pasos para reproducirlo y, si aplica, un `.lenspkg` de prueba mínimo;
- la versión de LensDesk y del sistema operativo.

Responderemos lo antes posible y te avisaremos cuando la corrección esté publicada.

## Qué se considera una vulnerabilidad

- Que una herramienta lea o modifique datos de otra herramienta o de LensDesk.
- Que una herramienta obtenga una ruta real de archivo o acceda a un archivo que el usuario no
  eligió.
- Que se instale un paquete con firma inválida, con archivos alterados o sin firma fuera del modo
  desarrollador.
- Que un `.lenspkg` manipulado escriba fuera de la carpeta de la herramienta.
- Que una herramienta use una API para la que no declaró permiso.
- Cualquier petición de red distinta del aviso de versión nueva, o la carga de contenido remoto.
- Que los registros guarden contenido del usuario (texto de notas, rutas de archivos).

## Qué no se considera una vulnerabilidad

- Que el sistema avise al abrir LensDesk por primera vez: las versiones no están firmadas con
  certificado de Apple ni de Microsoft.
- Lo que hace una herramienta sin firma que el usuario instaló con el modo desarrollador activo,
  dentro de los permisos que declaró.
- El acceso de otro programa o usuario con permisos sobre tu equipo a la carpeta de datos.
