import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Notification } from '../../../../common/notification/notification';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
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
