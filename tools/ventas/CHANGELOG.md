# Cambios / Changes

## [0.1.0] - 2026-11-07

- SQLite se ejecuta en un worker dedicado con cola por base de datos; el receptor atiende
  cancelaciones incluso durante un COMMIT largo, conservando atomicidad y reconciliación por recibo.
  SQLite runs in a dedicated worker with a per-database queue; the receiver handles cancellation
  even during a long COMMIT, preserving atomicity and receipt reconciliation.

- Icono de lista con verificaciones en la tarjeta y pestaña, compatible con LensDesk 0.5.0.
  Checklist icon in the tool card and tab, compatible with LensDesk 0.5.0.

- Restauraciones grandes con validación cooperativa por intervalos, sentencias reutilizadas
  y reemplazo atómico sin comprobaciones duplicadas; conserva límites, rollback y recibos.
  Large restores use time-sliced validation, reused statements and an atomic replacement
  without duplicate scans, preserving limits, rollback and receipts.

- Documentos del cliente sin vencimientos, plazos ni desglose de vencidos; fechas de compra,
  emisión, importes y saldos conservados. Cobranza interna y respaldos mantienen esos datos.
  Customer documents omit due dates, credit terms and overdue breakdowns while preserving
  purchase/issue dates, amounts and balances. Internal collections and backups retain those data.

Primera versión independiente de Ventas para LensDesk 0.5.0/API 1.
First independent Sales release for LensDesk 0.5.0/API 1.

- Inventario transaccional, recetas, preparación y costos racionales.
  Transactional inventory, recipes, preparation and rational costs.
- Carrito persistente, contado/crédito/parcial, vencimientos por compra y abonos FIFO.
  Persistent cart, cash/credit/partial sales, per-purchase due dates and FIFO payments.
- Caja por sesión, compras, gastos y retiros separados; cierres inmutables.
  Cash sessions, separate purchases/expenses/withdrawals and immutable closings.
- Devoluciones y reversas seguras, tickets históricos, estados de cuenta paginados y resumen.
  Safe returns/reversals, historical tickets, paginated statements and summaries.
- Respaldos completos nativos 1/modelo 7 (compatible con 5/6) y adaptación Web 1: validación, preview, confirmación,
  copia previa y reemplazo transaccional. Límite 20 MiB; sin pérdida silenciosa.
  Complete native 1/model 7 (compatible with 5/6) backups and Web 1 adaptation: validation, preview, confirmation,
  previous copy and transactional replacement. Maximum 20 MiB; no silent data loss.
- Filtros de inventario con productos desactivados visibles, preparación estimada por componente
  y entradas globales; gastos y caja con historiales completos y desglose de salidas.
  Inventory filters keep inactive products visible, with per-component preparation estimates,
  global receipts, full expense/cash histories and an outflow breakdown.
- Preferencias de negocio, bancos con alias y cuenta predeterminada, plazo inicial de clientes,
  iconos de producto opcionales y orden de catálogo preservado.
  Business preferences, bank aliases/default account, initial customer term, nullable product
  icons and preserved catalog order.
- Atajos F2/F4 para búsquedas, F9 para crédito y F10 para abrir Cobro desde Venta.
  F2/F4 search shortcuts, F9 credit and F10 checkout from Sale.
- es-MX/en-US, tema/acento heredados y flujos de teclado accesibles.
  es-MX/en-US, inherited theme/accent and accessible keyboard flows.

Vistas de tickets; impresión/PDF y publicación firmada no forman parte de esta implementación.
Ticket views; printing/PDF and signed publication are outside this implementation.
