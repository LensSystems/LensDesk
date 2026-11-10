# Ventas · Sales 0.1.0

Herramienta independiente de ventas minoristas e inventario para LensDesk. API 1; requiere
LensDesk 0.5.0 o posterior. Se instala desde su paquete `.lenspkg`; no viene preinstalada.
Empieza vacía y conserva sus datos localmente en SQLite.

- [Guía en español](docs/guia-es.md)
- [English guide](docs/guide-en.md)
- [Formato de respaldo / Backup format](docs/backup-format.md)
- [Cambios / Changes](CHANGELOG.md)

Independent retail sales and inventory tool for LensDesk. API 1; requires LensDesk 0.5.0 or newer.
Install its separate `.lenspkg` package. It starts empty and stores data locally in SQLite.

Incluye productos, materiales, bolsitas, clientes, crédito por compra, abonos FIFO, caja,
gastos/retiros, devoluciones, tickets históricos, consultas y respaldos nativos/Web 1 validados.
No incluye nube, facturación fiscal, bancos reales, impresión ni PDF.

Includes products, materials, prepared bags, customers, credit per purchase, FIFO payments,
cash sessions, expenses/withdrawals, returns, historical tickets, queries and validated native/Web 1
backups. No cloud, tax invoicing, real banking, printing or PDF.

Inventario ofrece filtros independientes de la búsqueda, preparación con estimación racional y
entrada global de mercancía. Gastos distingue compras, gastos y retiros, con acceso al historial
completo y a la caja compartida. Ajustes conserva bancos y preferencias sin cambiar tickets anteriores.
Los respaldos nuevos usan modelo 7 y admiten modelos nativos 5/6 y Web 1.

Inventory offers independent search and filters, preparation with rational cost estimates and
global merchandise entry. Expenses separates purchases, expenses and withdrawals, with full
histories and the shared cash dialog. Settings preserve bank preferences without rewriting old
tickets. New backups use model 7 and accept native models 5/6 and Web 1.

## Desarrollo / Development

Desde la raíz / From the repository root:

```sh
pnpm --filter @lensdesk/tool-ventas package
pnpm exec vitest run tools/ventas tests/unit/locales-parity.test.ts
pnpm exec playwright test tests/e2e/ventas.spec.ts --project=app
node packages/lenspkg/src/tool-release-cli.ts dry-run ventas-v0.1.0
```

El dry-run usa claves efímeras y no publica. No se requieren secretos de firma locales.
Dry-run uses ephemeral keys and does not publish. No local release signing secrets are required.
Windows, lectores de pantalla y pruebas humanas requieren comprobación en sus entornos;
la automatización macOS no acredita esos recorridos.
Windows, screen readers and human workflows require checks in those environments;
macOS automation does not establish those results.

Los tickets de venta, borradores y estados de cuenta destinados al cliente muestran fechas de
compra/emisión y saldos, sin vencimientos, plazos de crédito ni desglose de deuda vencida.
Estos datos se conservan para la cobranza interna en Cuentas, confirmaciones y Resumen, y en respaldos.

Customer sale tickets, drafts and statements show purchase/issue dates and balances, without
credit due dates, credit terms or overdue breakdowns. These remain available for internal
collections in Accounts, confirmations and Summary, and in backups.
