import { Prisma } from '@generated/prisma-payments';
import Stripe from 'stripe';
import { Notification } from '../../../../common/notification/notification';

export interface WebhookHandler {
  supports(event: Stripe.Event): boolean;
  handle(event: Stripe.Event, tx: Prisma.TransactionClient): Promise<Notification<void>>;
}
