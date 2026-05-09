import Stripe from 'stripe';

//Эта функция нужна для определения поступил ли этот ивент к нам при продлении подписки. Потому что этот ивент может прийти и при создании подписки и мы не должны учитывать его
export function isSubscriptionRenewal(invoice: Stripe.Invoice): boolean {
  return invoice.billing_reason === 'subscription_cycle';
}
