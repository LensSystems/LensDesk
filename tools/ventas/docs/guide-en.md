# Sales 0.1.0 guide

Install the separate package from Tools in LensDesk 0.5.0 or newer. Unsigned development packages
require developer mode. Use temporary profiles for testing, never real data. Sales starts empty;
configure your business and enter real inventory and customers.

## Daily workflow

1. Set business details, thank-you text and bank accounts in Sales settings.
2. Open cash before cash movements. Add products, materials in grams, packaging, recipes and
   purchases in Inventory. Prepare bags before selling them.
3. Select a customer or Counter, add products and charge. The cart persists without reserving stock.
   Stock is checked again at confirmation; failed sales preserve the cart.
4. Credit requires a customer. Every purchase has its own 1–30 day due date. Overdue balances or
   exceeded limits require an explicit reason; this does not authenticate an administrator.
5. Register payments in Accounts. They apply to the oldest purchases first. Merchandise purchases,
   business expenses and owner withdrawals remain separate.
6. Close cash with the counted amount and explain differences. Previous closings remain unchanged.

Money uses comma grouping and a decimal point. Search customers with arrow keys, Enter and Escape.
Theme, accent and language follow the host. Resolve uncertain operations before recording another;
the same key is retained. If confirmation succeeds but reloading fails, recover the data instead of
recording the sale again.

## History

Tickets preserve original prices, costs, customer, business and bank snapshots. Statements and
return details remain available across all pages, even after a total return. Returns reduce debt first
and refund the excess. Record a reason and whether the goods are sellable. Unsellable returns record
loss without subtracting stock again. Payment reversal preserves original records; Counter, opening
payments, already reversed payments and payments with related refunds are protected. Cash refunds
and reversals affect the current session, leaving past closings intact. Summary separates sales from
collections and supports negative periods for returns of earlier sales. Tickets are views: no printing,
PDF, tax invoicing or banking connection.

## Backup and recovery

In Settings, Save backup selects a real file and exports the complete history, not just visible pages.
Cancelling the picker changes nothing. Keep a copy outside the computer: files contain customer and
banking information and are not encrypted by this tool.

Select backup file accepts native 1/models 5, 6 and 7 and Web 1. Input and output must not exceed
20×1024×1024 actual bytes. Format, limits, references, stock, costs, balances and cash are validated
first. Review filename, format, counts, totals and limitations. Unrepresentable data is rejected,
never silently truncated.

Restore backup opens a confirmation. Replace current data replaces the whole dataset; it does not
merge or replay transactions. A complete previous copy is written, synced and verified before the
transaction. Failure leaves current data intact. Download the last confirmed previous copy from
the same section. Exported backups do not recursively embed previous-copy files; download that
copy separately when needed.

Changed files or current data require new selection/validation. Preparation expires after 10 minutes
and is replaced by another selection; restarting may require preparing again. A completed
confirmation is resolved from its persistent receipt without replacing data twice. Cancellation during
confirmation may leave an uncertain response: resolve the same operation. After restart, previous-copy
availability corresponds to the last confirmed restore.

## Web 1 compatibility

Textual folios, remapped UUIDs, opening balances, payments, returns, reversals, recipes, preparations
and reference-correlated purchases are preserved. Business extras, `done` and original data
are retained as non-executable provenance. Known product icons and catalog order are preserved;
missing or unknown icons use a safe fallback. Seed stock is kept with an explicit opening base,
without inventing purchases.

Missing business/customer/contact/received/change/bank history, ambiguous initial payments and
unknown global correction order are disclosed before confirmation. Current settings never replace
missing history. Tickets identify unavailable information. Valid historical bank snapshots survive
removal of the bank account from current settings.

Future versions, invalid/ambiguous JSON, duplicate IDs, Counter collisions, orphan references,
unmatched purchases, excessive returns, inconsistent costs/balances/closings, exceeded limits or
unrepresentable rational last costs are rejected. Settings support 20 banks; names 120 characters,
address/thank-you text 300 and phone 40. Longer text is not truncated.

Previous-copy durability relies on filesystem guarantees; a local copy does not protect against losing
the computer. Keep external exports. Windows and screen readers need independent human validation;
automated macOS checks do not establish those results.

## Inventory, preferences and keyboard

All, Low stock (including the minimum), Prepared bags and Raw materials filter independently
of name search. Inactive products stay visible; confirm activation before recording movements.
Status priority is Inactive, Out of stock, Low stock and Good.

New products start with no stock and a minimum of 5. Save the product, then its Recipe as separate
operations. A failed recipe save leaves the saved product intact. Recipes use one material in grams
(initially 100 g) and optional packaging by piece. Prepare bags defaults to 10 and shows consumption,
availability, result and estimated cost with the same per-component rounding as the final record.
Incomplete recipes, inactive ingredients and insufficient stock block confirmation. Receive
merchandise accepts active non-prepared products: enter quantity and total cost. Purchases and stock
are recorded once together.

In Expenses, Purchase merchandise uses that same receipt. Expenses and withdrawals affect money
without changing stock. Recent movements combines up to 50 rows from each source; select Full
history for search, periods and pages covering the rest. Cash includes an expandable outflow
breakdown; transfers stay outside cash counted. A closing difference requires a reason.

Settings supports business, owner/tax ID/cashier, the default term for new customers and up to
20 bank accounts. Aliases identify accounts in the interface; tickets show bank, holder and CLABE.
The default bank prefills new forms. Editing preferences never rewrites previous sales, due dates
or historical snapshots. New exports use model 7.

From Sale, F2 focuses products, F4 opens customer search, F9 opens credit and F10 opens Checkout.
They never confirm automatically or run inside a dialog. Escape closes dialogs when no write is
running. Use Tab/Shift+Tab to navigate and Enter/Space to activate controls.

## Manual checks on macOS and Windows

On each system, install the package in a test profile and create a material, packaging, recipe and
preparation. Record a sale, account payment, return, purchase, expense and cash closing. Export a
backup, change test data and restore while checking the previous copy. Restart and verify persistence.
Repeat in both themes and with reduced motion enabled in system settings; check shortcuts and
focus after dialogs close. Use VoiceOver on macOS or NVDA on Windows to check names, errors and
keyboard navigation. These are instructions, not human test results or accessibility certification.
