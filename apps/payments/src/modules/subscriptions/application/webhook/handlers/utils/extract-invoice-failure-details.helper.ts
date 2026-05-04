import Stripe from 'stripe';

export function extractInvoiceFailureDetails(invoice: Stripe.Invoice): {
  failureCode: string | null;
  failureMessage: string | null;
} {
  const lastFinalizationError: Stripe.Invoice.LastFinalizationError | null =
    invoice.last_finalization_error;

  if (!lastFinalizationError) {
    return { failureCode: null, failureMessage: null };
  }
  return {
    failureCode: lastFinalizationError.code ?? null,
    failureMessage: lastFinalizationError.message ?? null,
  };
}
