export const StripeEvents = {
  CheckoutSessionCompleted: 'checkout.session.completed', //подписка успешно оформлена
  CheckoutSessionExpired: 'checkout.session.expired', //сессия для оформления подписки expired
  InvoicePaymentSucceeded: 'invoice.payment_succeeded', //подписка успешно продлилась
  InvoicePaymentFailed: 'invoice.payment_failed', //подписка закончилась и перешла в состояние past_due, когда страйп ее еще может обновить
  SubscriptionUpdated: 'customer.subscription.updated', //В страйпе статус подписки обновился(продлилась или удалилась и тп), нужно для синхронизации с бэком
  SubscriptionDeleted: 'customer.subscription.deleted', //Подписка у пользователя закончилась и удалена
} as const;
