import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Notification } from '../../../../common/notification/notification';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { BillingPeriod } from '../types/billing-period.type';
import { StripeCheckoutSessionResult } from '../types/stripe-checkout-session-result.type';
import { NotificationResultCode } from '../../../../common/notification/notification-result-code';
import { CreateCheckoutSessionDTO } from './types/CreateCheckoutSessionDTO';
import { $Enums, PaymentProvider } from '@generated/prisma-payments';
import { extractCustomerId } from '../webhook/handlers/utils/extract-customer-id';
import PaymentStatus = $Enums.PaymentStatus;

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
    dto: CreateCheckoutSessionDTO,
  ): Promise<Notification<StripeCheckoutSessionResult>> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        //vitaliy[payments:refactor]: вынести subscription в enum
        mode: 'subscription',
        line_items: [{ price: dto.stripePriceId, quantity: 1 }],
        success_url: `${this.apiSettings.stripeSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: this.apiSettings.stripeCancelUrl,
        metadata: { userId: String(dto.userId), planId: dto.planId },
        //Если у нас покупатель не прилетел в дто, то этот параметр в дто обратится в undefined и страйп сам создаст нового покупателя
        customer: dto.stripeCusId,
      });

      if (!session.url || !session.customer) {
        this.logger.error(`Failed to create Stripe checkout session: ${session.id}`);
        return Notification.fail<StripeCheckoutSessionResult>(
          NotificationResultCode.InternalServerError,
          'Failed to create new subscription with payments provider',
        );
      }
      const customerId = extractCustomerId(session.customer);
      if (!customerId) {
        this.logger.error(`Failed to extract customerId: ${customerId}`);
        return Notification.fail<StripeCheckoutSessionResult>(
          NotificationResultCode.InternalServerError,
          'Failed to create new subscription with payments provider',
        );
      }
      return Notification.ok({
        url: session.url,
        sessionId: session.id,
        stripeCusId: customerId,
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
  // vitaliy[sf-payments:refactor]: удалить этот метод если он не нужен
  async getSubscription(stripeSubId: string): Promise<Stripe.Subscription> {
    return this.stripe.subscriptions.retrieve(stripeSubId);
  }
  // vitaliy[sf-payments:refactor]: если этот метод по окончанию написания логики будет использоваться только в рамках этого usecase, то сделать его приватным или вообще объединить два метода 'getBillingPeriodFromSubscriptionObject', 'retrieveSubscriptionBillingPeriod' если этот метоб будет использоваться только в методе 'retrieveSubscriptionBillingPeriod'.
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
  async retrieveSucceededPaymentFromInvoice(
    stripeInvoiceId: string,
  ): Promise<Notification<InvoicePayment>> {
    try {
      const invoice: Stripe.Invoice = await this.stripe.invoices.retrieve(stripeInvoiceId, {
        expand: ['payments'],
      });
      return this.retrievePayment(invoice);
    } catch (error) {
      const errorMessage: string = error instanceof Error ? error.message : 'Unknown Stripe error';
      const errorStack: string | undefined = error instanceof Error ? error.stack : '';

      this.logger.error(
        `Failed to retrieve Stripe invoice ${stripeInvoiceId}: ${errorMessage}`,
        errorStack,
      );

      return Notification.fail(
        NotificationResultCode.InternalServerError,
        'Failed to retrieve subscription from the payment provider',
      );
    }
  }
  private retrievePayment(invoice: Stripe.Invoice): Notification<InvoicePayment> {
    const items: Stripe.InvoicePayment[] | undefined = invoice.payments?.data;
    if (!items) {
      return Notification.fail(NotificationResultCode.BadRequest, 'This invoice have no payments');
    }
    const succeededPayment: Stripe.InvoicePayment | undefined = items.find(
      (payment) => payment.status === 'paid',
    );
    if (!succeededPayment) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        `This invoice ${invoice.id} have no succeeded payments`,
      );
    }
    if (!succeededPayment.amount_paid) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        'This succeeded payment has no amount_paid',
      );
    }
    //todo убрать заглушку
    return Notification.ok({
      amount: succeededPayment.amount_paid,
      currency: succeededPayment.currency,
      planId: 'заглушка, надо подумать откуда взять планid',
      status: PaymentStatus.PAID,
      provider: PaymentProvider.STRIPE,
    });
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
// vitaliy[payments:refactor]: вынести этот тип из usecase
export type InvoicePayment = {
  amount: number;
  currency: string;
  planId: string;
  status: PaymentStatus;
  provider: PaymentProvider;
};
