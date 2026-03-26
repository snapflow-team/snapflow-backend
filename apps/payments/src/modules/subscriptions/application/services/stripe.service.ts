import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Notification } from '../../../../common/notification/notification';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly apiSettings: ApiSettings;

  constructor(configService: ConfigService<Configuration, true>) {
    this.apiSettings = configService.get<ApiSettings>('apiSettings');
    this.stripe = new Stripe(this.apiSettings.stripeSecretKey);
  }

  async createCheckoutSession(
    stripePriceId: string,
    planId: string,
    userId: number,
  ): Promise<Notification<string>> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: stripePriceId, quantity: 1 }],
        success_url: `${this.apiSettings.stripeSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: this.apiSettings.stripeCancelUrl,
        metadata: { userId: String(userId), planId },
      });

      if (!session.url) {
        return Notification.fail('Stripe did not return a checkout URL', 'stripe');
      }

      return Notification.ok<string>(session.url);
    } catch (error) {
      return Notification.fail(`Stripe SDK error: ${error.message}`, 'stripe');
    }
  }

  constructWebhookEvent(rawBody: Buffer, signature: string): Notification<Stripe.Event> {
    try {
      const event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.apiSettings.stripeWebhookSecret,
      );
      return Notification.ok(event);
    } catch (error) {
      return Notification.fail('Invalid webhook signature');
    }
  }
}
