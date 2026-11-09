# Guía de Ventas 0.1.0

Instala el paquete independiente desde Herramientas con LensDesk 0.5.0 o posterior. Un paquete de
desarrollo sin firma requiere modo desarrollador. Para probar, usa un perfil temporal, no datos reales.
La herramienta empieza vacía; configura tu negocio y registra existencias y clientes reales.

## Recorrido diario

1. Configura negocio, agradecimiento y cuentas en Ajustes de Ventas.
2. Abre caja antes de entradas/salidas de efectivo. En Inventario registra productos, gramos,
   empaques, recetas y compras; prepara bolsitas antes de venderlas.
3. Selecciona un cliente o Mostrador, agrega productos y cobra. El carrito se guarda sin reservar
   existencias. Se revisan nuevamente al confirmar; una venta fallida conserva el carrito.
4. El crédito requiere cliente. Cada compra tiene su propio vencimiento, de 1 a 30 días. Vencidos o
   límites excedidos exigen motivo explícito; eso no equivale a autenticar un administrador.
5. En Cuentas registra abonos: se aplican primero a las compras más antiguas. Compras de mercancía,
   gastos del negocio y retiros del propietario permanecen separados.
6. Cierra caja con el efectivo contado y explica diferencias. Los cierres anteriores no se reescriben.

Los importes usan coma de miles y punto decimal. El cliente se busca por teclado con flechas,
Enter y Escape. Tema, acento e idioma se heredan del host. Si una respuesta queda incierta, usa
«Resolver operación» antes de registrar otra; se conserva la misma clave. Tras confirmación con
lectura fallida, recupera los datos: no vuelvas a registrar la venta.

## Historial

Tickets conserva el precio, costo, cliente, negocio y banco originales. Puedes consultar todas las
páginas del estado de cuenta y el detalle de cada devolución, incluso tras una devolución total.
Una devolución reduce deuda primero y reembolsa el exceso; indica motivo y si regresa vendible.
No vendible registra pérdida sin descontar otra vez el inventario. Anular abonos conserva originales
con una reversa; se bloquean Mostrador, saldos iniciales, pagos ya anulados o con reembolsos relacionados.
Los reembolsos/reversas en efectivo pertenecen a la caja actual, no cambian un cierre pasado.
Resumen separa ventas y cobros, y admite periodos negativos cuando se devuelven ventas anteriores.
Los tickets son vistas; no hay impresión, PDF, facturación fiscal ni conexión bancaria.

## Respaldo y recuperación

En Ajustes, «Guardar respaldo» elige un archivo real y exporta todo el historial, no solo las páginas
visibles. Cancelar el selector no modifica datos. Guarda una copia fuera del equipo: contiene
clientes e información bancaria y no está cifrada por la herramienta.

«Seleccionar archivo de respaldo» admite el formato nativo 1/modelos 5, 6 y 7 y Web 1. El máximo es
20×1024×1024bytes reales de entrada y salida. Primero se valida formato, límites, referencias,
existencias, costos, saldos y caja. Revisa nombre, formato, conteos, totales y advertencias.
Cualquier dato no conservable se rechaza; no se trunca para hacerlo caber.

«Recuperar respaldo» abre una confirmación: «Reemplazar datos actuales» sustituye el conjunto
completo; no fusiona ni vuelve a ejecutar movimientos. Una copia completa anterior se escribe,
sincroniza y verifica antes de la transacción. Si falla, no se reemplazan datos. La última copia
previa confirmada se descarga desde la misma sección. No se incluyen copias previas recursivas
en el archivo exportado; descarga esa copia aparte cuando la necesites.

Cambiar el archivo o los datos actuales exige seleccionar/validar de nuevo. La preparación caduca
a los 10 minutos y se sustituye al seleccionar otro archivo; tras reiniciar puede requerirse repetirla.
Una confirmación ya completada se resuelve mediante su recibo persistente, sin repetir el reemplazo.
Cancelar durante confirmación puede dejar respuesta incierta: resuélvela con la misma operación.
Después de reiniciar, la disponibilidad de la copia previa corresponde a la última restauración confirmada.

## Compatibilidad Web 1

Se conservan folios textuales, IDs remapeados a UUID, saldos iniciales, pagos, devoluciones,
reversas, recetas, preparaciones y compras correlacionadas por referencias. Extras de negocio,
`done` y originales se archivan como procedencia no ejecutable. Los iconos conocidos y el orden
del catálogo se conservan; un icono ausente o desconocido usa una imagen de reserva segura.
Los stocks semilla se conservan con una base inicial identificada, sin inventar compras.

Se declaran antes de confirmar los datos históricos ausentes: negocio, contacto/nombre del cliente,
recibido/cambio, pago inicial ambiguo, banco y orden global de correcciones antiguas. No se rellenan
con ajustes actuales. Los tickets indican lo desconocido. Una instantánea bancaria válida se conserva
aunque la cuenta haya sido eliminada de la configuración.

Se rechazan versiones futuras, JSON inválido/ambiguo, IDs duplicados, colisiones con Mostrador,
referencias huérfanas, compras sin correlación, sobredevoluciones, costos/saldos/cierres incoherentes,
exceso de límites y último costo sin representación racional fiel. Configuración: máximo 20 bancos;
nombres 120 caracteres, dirección/agradecimiento 300 y teléfono 40. No se cortan textos largos.

La sincronización del archivo previo utiliza las garantías del sistema de archivos; ninguna copia
local protege frente a pérdida del equipo. Conserva exportaciones externas. Windows y lectores de
pantalla requieren validación humana independiente; no se acredita con pruebas automatizadas macOS.

## Inventario, preferencias y teclado

Todos, Bajo stock (incluye el mínimo), Bolsitas y Materia prima filtran por separado de la búsqueda
por nombre. Los desactivados permanecen visibles; actívalos con confirmación antes de registrar
movimientos. La prioridad del estado es Desactivado, Sin stock, Bajo stock y Bien.

Un producto nuevo comienza sin existencias y con mínimo 5. Guarda el producto y después su
Receta como operaciones separadas; si falla guardar la receta, el producto ya guardado permanece.
La receta usa una materia prima en gramos (100 g inicialmente) y un empaque opcional por pieza.
Preparar bolsitas propone 10 unidades y muestra consumo, disponibilidad, resultado y costo estimado
con el mismo redondeo por componente del registro definitivo. Receta incompleta, insumos inactivos
o existencias insuficientes impiden confirmar. La entrada de mercancía permite productos activos
no preparados: captura cantidad y costo total; registra compra y existencias una sola vez.

En Gastos, Compra de mercancía usa la misma entrada. Gastos y retiros registran dinero sin cambiar
existencias. Movimientos recientes combina hasta 50 registros de cada fuente; selecciona Historial
completo para consultar el resto con búsqueda, periodo y páginas. Caja muestra el desglose de
salidas; las transferencias quedan fuera del efectivo. Un cierre con diferencia exige motivo.

Ajustes permite negocio, propietario/RFC/cajero, plazo predeterminado para clientes nuevos y hasta
20 cuentas bancarias. El alias identifica la cuenta en la interfaz; el ticket muestra banco, titular y
CLABE. El banco predeterminado precarga formularios nuevos. Editar estos valores no reescribe
ventas, vencimientos ni instantáneas históricas. Los respaldos nuevos exportan modelo 7.

Desde Venta, F2 enfoca productos, F4 abre la búsqueda de clientes, F9 abre crédito y F10 abre Cobro.
No confirman automáticamente ni funcionan dentro de un diálogo. Escape cierra diálogos cuando
no hay escritura en curso. Usa Tab/Shift+Tab para moverte y Enter/Espacio para activar controles.

## Comprobación manual en macOS y Windows

En cada sistema, instala el paquete en un perfil de prueba y recorre alta de material/empaque,
receta y preparación; registra una venta, abono, devolución, compra, gasto y cierre. Exporta un
respaldo, cambia un dato de prueba y recupéralo revisando la copia previa. Reinicia y comprueba
persistencia. Repite con ambos temas y con movimiento reducido activado en el sistema; prueba
los atajos y el foco al cerrar diálogos. Con VoiceOver en macOS o NVDA en Windows comprueba
nombres, errores y navegación del teclado. Estos pasos son instrucciones, no resultados humanos
ni certificación de accesibilidad.
