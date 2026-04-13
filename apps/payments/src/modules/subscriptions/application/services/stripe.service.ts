import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Notification } from '../../../../common/notification/notification';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { BillingPeriod } from '../types/billing-period.type';
import { StripeCheckoutSessionResult } from '../types/stripe-checkout-session-result.type';
import { NotificationResultCode } from '../../../../common/notification/notification-result-code';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly apiSettings: ApiSettings;
  private readonly logger: Logger = new Logger(StripeService.name);

  constructor(configService: ConfigService<Configuration, true>) {
    this.apiSettings = configService.get<ApiSettings>('apiSettings');
    this.stripe = new Stripe(this.apiSettings.stripeSecretKey);
  }

  async createCheckoutSession(
    stripePriceId: string,
    planId: string,
    userId: number,
  ): Promise<Notification<StripeCheckoutSessionResult>> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: stripePriceId, quantity: 1 }],
        success_url: `${this.apiSettings.stripeSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: this.apiSettings.stripeCancelUrl,
        metadata: { userId: String(userId), planId },
      });

      if (!session.url) {
        return Notification.fail<StripeCheckoutSessionResult>(
          NotificationResultCode.InternalServerError,
          'Internal payment gateway configuration error',
        );
      }

      return Notification.ok({
        url: session.url,
        sessionId: session.id,
      });
    } catch (error) {
      const errorMessage: string = error instanceof Error ? error.message : 'Unknown Stripe error';
      const errorStack: string | undefined = error instanceof Error ? error.stack : '';

      this.logger.error(`Failed to create Stripe checkout session: ${errorMessage}`, errorStack);

      return Notification.fail<StripeCheckoutSessionResult>(
        NotificationResultCode.InternalServerError,
        'Failed to communicate with the payment provider',
      );
    }
  }

  // vilyamz: не нужно ли этот метод сделать приватным?
  getBillingPeriodFromSubscriptionObject(sub: Stripe.Subscription): Notification<BillingPeriod> {
    const item: Stripe.SubscriptionItem | undefined = sub.items.data[0];

    if (!item) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        'Subscription has no subscription items to read billing period from',
      );
    }

    return Notification.ok({
      start: new Date(item.current_period_start * 1000),
      end: new Date(item.current_period_end * 1000),
    });
  }

  async retrieveSubscriptionBillingPeriod(
    stripeSubscriptionId: string,
  ): Promise<Notification<BillingPeriod>> {
    try {
      const sub: Stripe.Subscription = await this.stripe.subscriptions.retrieve(
        stripeSubscriptionId,
        { expand: ['items.data'] },
      );

      return this.getBillingPeriodFromSubscriptionObject(sub);
    } catch (error) {
      const errorMessage: string = error instanceof Error ? error.message : 'Unknown Stripe error';
      const errorStack: string | undefined = error instanceof Error ? error.stack : '';

      this.logger.error(
        `Failed to retrieve Stripe subscription ${stripeSubscriptionId}: ${errorMessage}`,
        errorStack,
      );

      return Notification.fail(
        NotificationResultCode.InternalServerError,
        'Failed to retrieve subscription from the payment provider',
      );
    }
  }

  constructEvent(rawBody: Buffer, signature: string): Notification<Stripe.Event> {
    try {
      const event: Stripe.Event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.apiSettings.stripeWebhookSecret,
      );

      return Notification.ok(event);
    } catch (error) {
      const errorMessage: string = error instanceof Error ? error.message : 'Unknown Stripe error';
      const errorStack: string | undefined = error instanceof Error ? error.stack : '';

      this.logger.error(`Webhook signature verification failed: ${errorMessage}`, errorStack);

      return Notification.fail(NotificationResultCode.BadRequest, 'Invalid webhook signature');
    }
  }
}
