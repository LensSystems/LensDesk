import type { Snapshot } from "../shared/contracts.ts";
import type { PaymentInput } from "../shared/trading-contracts.ts";

export function saleReviewSignature(data: Snapshot) {
  const client = data.clients.find((record) => record.id === data.draft.clientId);
  return JSON.stringify({
    draft: data.draft,
    products: data.draft.lines.map((line) => {
      const product = data.products.find((record) => record.id === line.productId);
      return product
        ? { id: product.id, price: product.price, stock: product.stock, active: product.active }
        : null;
    }),
    client,
    account: data.accounts.find((record) => record.clientId === client?.id),
    settings: data.settings,
    today: data.today,
    cashId: data.cash?.id ?? null,
  });
}

export function captureSaleReview(data: Snapshot, total: number, payment: PaymentInput) {
  const client = data.clients.find((record) => record.id === data.draft.clientId);
  const account = data.accounts.find((record) => record.clientId === client?.id);
  return {
    total,
    payment: { ...payment },
    signature: saleReviewSignature(data),
    data: {
      ...data,
      draft: structuredClone(data.draft),
      clients: client ? [{ ...client }] : [],
      accounts: account ? [{ ...account }] : [],
      settings: structuredClone(data.settings),
    },
  };
}
