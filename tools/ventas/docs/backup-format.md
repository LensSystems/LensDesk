# Backup format / Formato de respaldo · 0.1.0

The portable native envelope is JSON UTF-8:
El envelope nativo portable es JSON UTF-8:

```json
{"format":"lensdesk-ventas-native-backup","version":1,"modelVersion":7,"createdAt":"2026-11-07T18:00:00.000Z","toolVersion":"0.1.0","revision":0,"data":{}}
```

`data` in this abbreviated illustration must contain every listed table, including empty arrays.
`data` en este ejemplo abreviado debe contener todas las tablas siguientes, incluso las vacías.

| Tables / Tablas | Content / Contenido |
|---|---|
| settings, products, recipes, clients | Current configuration and catalog / Configuración y catálogo |
| sales, payments, payment_allocations | Complete original sales, payments and assignments / Originales completos |
| returns, return_lines, payment_reversals | Inverse events with original references / Correcciones y referencias |
| movements, purchases, outflows | Full stock and money history / Historial completo |
| cash_sessions | All sessions, immutable closing JSON / Todas las sesiones y cierres |
| draft, draft_lines, sequences, operations | Cart, counters and native idempotency / Carrito, contadores e idempotencia |
| import_archives, origins, inventory_bases | Source payload, IDs/folios/missing fields and opening stock / Procedencia y bases |
| restore_history | Portable record of restore events / Registro portable de recuperaciones |

Rows retain all model 7 storage columns. Scalar values are strings, safe integers or null; storage
booleans use 0/1. JSON-valued columns remain JSON strings. UUIDs, line UUIDs, folios, fingerprints,
results and original snapshots are preserved. The importer uses a fixed table/column allowlist and
bound values; the file cannot supply SQL. Schema migration records and WAL are implementation
state, not portable data. Local `restore_receipts` and previous-copy files remain local recovery
control; they are not replaced by imported operation keys or recursively embedded. Download the
last previous copy separately. Portable `restore_history` retains restore-event provenance.

Las filas conservan todas las columnas del modelo 7. Escalares: texto, entero seguro o null;
booleanos almacenados como 0/1. Las columnas JSON siguen siendo cadenas JSON. Se conservan UUID,
folios, fingerprints, resultados e instantáneas. Tablas/columnas se fijan en código y los valores se
parametrizan: el archivo no aporta SQL. Migraciones y WAL son estado de implementación.
`restore_receipts` y archivos previos son control local: no se sustituyen con claves importadas ni
se incluyen recursivamente. La copia previa se descarga aparte; `restore_history` conserva procedencia.

Web 1 is `lensdesk-ventas-backup`, version 1, with `business` and `ledger`. IDs may be strings or
safe integer numbers; ambiguous numeric/string collisions are rejected. Mapping is deterministic
by entity type and original ID; Mostrador is reserved as null. Text folios stay in `origins`, separate
from numeric native counters. `import_archives` preserves the validated original payload, including
extra business fields, `done`, product icons and preparations, as non-executable provenance.
Missing historical facts are flagged explicitly. An ambiguous initial payment stays unknown.
Original line/product references, quantities, cumulative rounded costs, balances, cash and opening
stock bases must reconcile. Fractional last cost uses a faithful representable rational pair.

Web 1 contiene `business` y `ledger`. Los IDs se remapean de forma determinista por entidad e ID
original; se rechazan colisiones ambiguas entre número y texto. Mostrador es null reservado.
Los folios de texto se conservan en `origins`, separados del contador nativo. `import_archives`
conserva originales y extras como procedencia no ejecutable. Lo histórico ausente se marca, sin
rellenarlo desde ajustes actuales. El pago inicial ambiguo permanece desconocido. Referencias,
cantidades, costos proporcionales acumulados, saldos, caja y bases iniciales deben reconciliarse.

Both formats: maximum 20 MiB actual UTF-8 bytes, including normalized output; at most 100,000 rows
per table, 1,000 sale/cart lines, 50 queried history rows, 20 current bank accounts, nesting depth 50.
Field limits also apply. Duplicate keys, dangerous keys, unsupported versions, unsafe/non-integral
financial numbers, broken references and reconciliation failures are rejected before mutation.
Preparation binds the source hash, ID and current revision, expires after 10 minutes, and retains
at most one preparation per database/two per backend runtime. Confirmation rereads the source, preserves a
verified previous copy, rechecks revision inside the replacement transaction and advances revision
monotonically. Retry checks persistent local receipts before requiring preparation/token again.

Ambos formatos: máximo 20 MiB reales UTF-8, incluida salida normalizada; hasta 100 000 filas por tabla,
1 000 líneas de venta/carrito, 50 filas por consulta, 20 bancos actuales y 50 niveles de anidación.
Rigen límites por campo. La validación ocurre antes de mutar. Preparación ligada a hash/ID/revisión,
caducidad 10 min, una por base/dos por runtime del backend. Se relee el archivo, se conserva copia verificada y se
revalida la revisión dentro de la transacción. Reintentos consultan recibos locales persistentes primero.

## Cancellation and recovery / Cancelación y recuperación

Each database has one dedicated SQLite worker. All methods share its queue, bounded to 32 active
and waiting requests. At most two database workers remain resident per backend runtime; a third
database is rejected with `E_BACKEND_UNAVAILABLE` until a worker exits. Idle workers retain the
prepared backup and do not keep the receiving process alive. A failing worker keeps its database
and capacity slot until its actual exit or completed termination; late messages cannot release it.
The file bridge allows at most 32 native capability operations in flight per runtime. Cancellation
or a worker crash retains each slot until the underlying file promise settles. Excess calls are
rejected with `E_BACKEND_UNAVAILABLE` before invoking native file I/O.

The receiver answers cancellation within one second even when the physical SQLite COMMIT takes
longer. A cancelled waiting request never runs. An active cancelled request retains database
ownership until its worker finishes; subsequent queries and mutations wait. Cancellation before
replacement rolls back or preserves the previous state. After the irreversible commit point,
`E_CANCELLED` does not establish whether a mutation committed. Retry confirmation with the same
restore key and fingerprint to reconcile the durable receipt; retry `execute` with its original
operation key and action. A worker crash rejects pending work without automatic replay. An
explicit subsequent request starts a new worker and can reconcile persisted receipts. WAL, FULL
synchronization, atomic replacement, revision checks and rollback remain in effect.

Cada base tiene un worker SQLite exclusivo. Todos los métodos comparten su cola, limitada a 32
solicitudes activas y en espera. Cada runtime conserva como máximo dos workers de base de datos;
una tercera base recibe `E_BACKEND_UNAVAILABLE` hasta que termine un worker. Los workers inactivos
conservan la preparación y permiten que el proceso receptor termine. Un worker en fallo conserva
su base y su plaza hasta confirmar su salida o terminación completa; mensajes tardíos no la liberan.
El puente admite como máximo 32 operaciones nativas de archivo en vuelo por runtime. Cancelar o
perder el worker conserva cada plaza hasta que se resuelva la promesa de archivo subyacente.
El exceso recibe `E_BACKEND_UNAVAILABLE` antes de invocar la operación nativa.

El receptor responde a la cancelación en menos de un segundo aunque el COMMIT físico tarde más.
Una solicitud cancelada en espera nunca se ejecuta. Una solicitud activa cancelada conserva la
propiedad de la base hasta que termine el worker; consultas y mutaciones posteriores esperan.
Antes del reemplazo, cancelar conserva el estado previo o revierte la transacción. Después del
punto irreversible, `E_CANCELLED` no confirma si se guardó la mutación. Reintentar confirmación
con la misma clave y fingerprint permite consultar el recibo persistente; `execute` se reintenta
con su clave de operación y acción originales. Una caída rechaza el trabajo pendiente sin repetirlo
automáticamente. Una solicitud explícita posterior crea otro worker y puede reconciliar recibos.
Se conservan WAL, sincronización FULL, reemplazo atómico, revisión y rollback.

## Model compatibility / Compatibilidad de modelos

New exports use model 7. Native models 5 and 6 remain importable; model 7 includes nullable
`products.icon` metadata and preserves catalog insertion order. Known Web 1 icons are mapped
from validated provenance; unknown or absent values stay null. Icon recovery does not change
stock, value, rational last-cost pairs, operation fingerprints, original financial rows or snapshots.

Las exportaciones nuevas usan modelo 7. Se admiten modelos nativos 5 y 6. El modelo 7 incluye
`products.icon` nullable y conserva orden de inserción del catálogo. Solo se recuperan iconos Web 1
conocidos desde procedencia validada; los ausentes o desconocidos quedan null. No se modifican
existencias, valores, fracciones de último costo, fingerprints ni filas o instantáneas financieras.

Model 6 adds current business and bank preferences. Model 5 defaults those optional fields without
backfilling historical sales. Repeated bank IDs accepted by old native model 5 are normalized only
in the current bank catalog with deterministic IDs and `originalId`; historical snapshots and
references retain their originals. Explicit model 6/7 duplicate IDs remain invalid.

El modelo 6 añade preferencias actuales de negocio y bancos. Modelo 5 obtiene valores por defecto
sin rellenar ventas históricas. IDs bancarios repetidos admitidos por modelo 5 antiguo se normalizan
solo en el catálogo actual con IDs deterministas y `originalId`; referencias e instantáneas
históricas conservan sus originales. Duplicados explícitos en modelos 6/7 siguen rechazados.

## Bitácora de cambios

| Fecha | Cambio |
| --- | --- |
| 10/nov/2026 | Documentación de cancelación receptiva, cola, límites de workers, operaciones nativas pendientes y recuperación por recibos. |
