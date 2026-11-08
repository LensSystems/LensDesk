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
