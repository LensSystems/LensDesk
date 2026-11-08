# Backup format / Formato de respaldo · 0.1.0

The portable native envelope is JSON UTF-8:
El envelope nativo portable es JSON UTF-8:

```json
{"format":"lensdesk-ventas-native-backup","version":1,"modelVersion":5,"createdAt":"2026-11-07T18:00:00.000Z","toolVersion":"0.1.0","revision":0,"data":{}}
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

Rows retain all model 5 storage columns. Scalar values are strings, safe integers or null; storage
booleans use 0/1. JSON-valued columns remain JSON strings. UUIDs, line UUIDs, folios, fingerprints,
results and original snapshots are preserved. The importer uses a fixed table/column allowlist and
bound values; the file cannot supply SQL. Schema migration records and WAL are implementation
state, not portable data. Local `restore_receipts` and previous-copy files remain local recovery
control; they are not replaced by imported operation keys or recursively embedded. Download the
last previous copy separately. Portable `restore_history` retains restore-event provenance.

Las filas conservan todas las columnas del modelo 5. Escalares: texto, entero seguro o null;
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
at most one preparation per database/two globally. Confirmation rereads the source, preserves a
verified previous copy, rechecks revision inside the replacement transaction and advances revision
monotonically. Retry checks persistent local receipts before requiring preparation/token again.

Ambos formatos: máximo 20 MiB reales UTF-8, incluida salida normalizada; hasta 100 000 filas por tabla,
1 000 líneas de venta/carrito, 50 filas por consulta, 20 bancos actuales y 50 niveles de anidación.
Rigen límites por campo. La validación ocurre antes de mutar. Preparación ligada a hash/ID/revisión,
caducidad 10 min, una por base/dos globales. Se relee el archivo, se conserva copia verificada y se
revalida la revisión dentro de la transacción. Reintentos consultan recibos locales persistentes primero.
