import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Notification } from '../../../../common/notification/notification';
import { Configuration } from '../../../../setup/configuration/configuration';
import { ApiSettings } from '../../../../setup/configuration/api-settings';
import { BillingPeriod } from '../types/billing-period.type';
import { StripeCheckoutSessionResult } from '../types/stripe-checkout-session-result.type';
import { NotificationResultCode } from '../../../../common/notification/notification-result-code';
import { CreateCheckoutSessionDto } from './types/create-checkout-session.dto';
import { $Enums, PaymentProvider } from '@generated/prisma-payments';
import { InvoicePayment } from '../types/invoice-payment.type';
import { DateService } from '../../../../../../../libs/common/services/date.service';
import { CheckoutSessionMetadata } from '../types/checkout-session-metadata.type';
import { StripeCSModes } from './types/stripe-checkout-session-modes.enum';
import PaymentStatus = $Enums.PaymentStatus;

@Injectable()
export class StripeService {
  private readonly stripe: Stripe;
  private readonly apiSettings: ApiSettings;
  private readonly logger: Logger = new Logger(StripeService.name);

  constructor(
    configService: ConfigService<Configuration, true>,
    private dateService: DateService,
  ) {
    this.apiSettings = configService.get<ApiSettings>('apiSettings');
    this.stripe = new Stripe(this.apiSettings.stripeSecretKey);
  }

  async getSubscription(stripeSubId: string): Promise<Stripe.Subscription> {
    return await this.stripe.subscriptions.retrieve(stripeSubId);
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

  async createCheckoutSession(
    dto: CreateCheckoutSessionDto,
  ): Promise<Notification<StripeCheckoutSessionResult>> {
    try {
      const session = await this.stripe.checkout.sessions.create({
        mode: dto.mode,
        line_items: [{ price: dto.stripePriceId, quantity: 1 }],
        success_url: `${this.apiSettings.stripeSuccessUrl}?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: this.apiSettings.stripeCancelUrl,
        metadata: this.createCheckoutSessionMetadataObject(dto),
        //Если у нас покупатель не прилетел в дто, то этот параметр в дто обратится в undefined и страйп сам создаст нового покупателя
        customer: dto.stripeCusId,
      });
      if (dto.mode === StripeCSModes.Payment) {
        this.logger.debug(`checkout session for extending: ${session.id}`);
      }
      if (!session.url) {
        this.logger.error(`Failed to create stripe checkout session: ${session.id}`);
        return Notification.fail<StripeCheckoutSessionResult>(
          NotificationResultCode.InternalServerError,
          'Failed to create new subscription with payments provider',
        );
      }
      this.logger.debug(`Created checkout session: ${session.id}`);
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

  async updateAutoRenewal(stripeSubId: string, autoRenewal: boolean): Promise<Notification<void>> {
    try {
      const isCancelAtPeriodEnd = !autoRenewal;
      await this.stripe.subscriptions.update(stripeSubId, {
        //Этот флаг в страйпе отвечает за то, будет ли продлена подписка если она закончится, т е фактически autoRenewal
        cancel_at_period_end: isCancelAtPeriodEnd,
      });

      return Notification.ok();
    } catch (error) {
      const errorMessage: string = error instanceof Error ? error.message : 'Unknown Stripe error';
      const errorStack: string | undefined = error instanceof Error ? error.stack : '';

      this.logger.warn(
        `Failed to update autoRenewal for ${stripeSubId}, error: ${errorMessage}, ${errorStack}`,
      );

      return Notification.fail(
        NotificationResultCode.InternalServerError,
        `Some error occurred with payment provider`,
      );
    }
  }

  async extendSubscription(stripeSubId: string, newEnd: Date): Promise<void> {
    await this.stripe.subscriptions.update(stripeSubId, {
      //Ставим новую дату протухания подписки
      trial_end: this.dateService.convertDateToSeconds(newEnd),
      //Задаем поведению страйпу, чтобы он не делал никаких попыток досчитать что-то прямо сейчас
      proration_behavior: 'none',
    });
  }

  private getBillingPeriodFromSubscriptionObject(
    sub: Stripe.Subscription,
  ): Notification<BillingPeriod> {
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

    return Notification.ok({
      amount: succeededPayment.amount_paid,
      currency: succeededPayment.currency,
      status: PaymentStatus.PAID,
      provider: PaymentProvider.STRIPE,
    });
  }

  private createCheckoutSessionMetadataObject(dto: CreateCheckoutSessionDto): Stripe.Metadata {
    if (dto.extendingSubscriptionId) {
      return {
        userId: String(dto.userId),
        planId: dto.planId,
        subscriptionDuration: String(dto.subscriptionDurationInDays),
        extendingSubscriptionId: dto.extendingSubscriptionId,
      } satisfies CheckoutSessionMetadata;
    } else {
      return {
        userId: String(dto.userId),
        planId: dto.planId,
        subscriptionDuration: String(dto.subscriptionDurationInDays),
      } satisfies CheckoutSessionMetadata;
    }
  }
}
