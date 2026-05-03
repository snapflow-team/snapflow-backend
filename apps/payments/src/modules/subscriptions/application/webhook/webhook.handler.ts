import Stripe from 'stripe';
import { Notification } from '../../../../common/notification/notification';

export interface WebhookHandler {
  supports(event: Stripe.Event): boolean;
  handle(event: Stripe.Event): Promise<Notification<void>>;
}
