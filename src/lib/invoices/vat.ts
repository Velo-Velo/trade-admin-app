/** UK standard rate. The figure in a quick invoice is the customer total unless the text says plus VAT. */
export const UK_VAT_RATE = 20;

export function splitVat(
  amountPence: number,
  vatRegistered: boolean,
  exclusive: boolean,
): { netPence: number; vatPence: number; totalPence: number; vatRate: number } {
  if (!vatRegistered || amountPence <= 0) {
    return { netPence: amountPence, vatPence: 0, totalPence: amountPence, vatRate: 0 };
  }
  if (exclusive) {
    const vatPence = Math.round((amountPence * UK_VAT_RATE) / 100);
    return { netPence: amountPence, vatPence, totalPence: amountPence + vatPence, vatRate: UK_VAT_RATE };
  }
  const vatPence = Math.round((amountPence * UK_VAT_RATE) / (100 + UK_VAT_RATE));
  return {
    netPence: amountPence - vatPence,
    vatPence,
    totalPence: amountPence,
    vatRate: UK_VAT_RATE,
  };
}
