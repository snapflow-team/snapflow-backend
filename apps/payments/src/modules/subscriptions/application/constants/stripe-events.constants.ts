export const StripeEvents = {
  CheckoutSessionCompleted: 'checkout.session.completed',
  InvoicePaymentFailed: 'invoice.payment_failed',
  CheckoutSessionExpired: 'checkout.session.expired',
  //PaymentIntentSucceeded: 'payment_intent.succeeded',
} as const;
