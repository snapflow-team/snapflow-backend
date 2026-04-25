import { Module } from '@nestjs/common';
import { RemoteAuthGuard } from '../auth/guards/remote-auth.guard';
import { OutboxModule } from '../outbox/outbox.module';
import { SubscriptionsController } from './api/subscriptions.controller';
import { GetPlansQueryHandler } from './application/queries/get-plans.query-handler';
import { CreateCheckoutSessionUseCase } from './application/usecases/create-checkout-session.usecase';
import { StripeService } from './application/services/stripe.service';
import { SubscriptionsRepository } from './infrastructure/subscriptions.repository';
import { StripeWebhookController } from './api/stripe-webhook.controller';
import { HandleStripeWebhookUseCase } from './application/usecases/handle-stripe-webhook.usecase';
import { PaymentsRepository } from './infrastructure/payments.repository';
import { CustomersRepository } from './infrastructure/customers.repository';
import { CheckoutSessionCompletedHandler } from './application/webhook/handlers/checkout-session-completed-handler';
import { CheckoutSessionExpiredHandler } from './application/webhook/handlers/checkout-session-expired-handler';
import { InvoicePaymentSucceededHandler } from './application/webhook/handlers/invoice-payment-succeeded-handler';
import { InvoicePaymentFailedHandler } from './application/webhook/handlers/invoice-payment-failed-handler';
import { WEBHOOK_HANDLERS } from '../../core/providers/provide-tokens/webhook-handlers.inject-token';

const controllers = [SubscriptionsController, StripeWebhookController];
const useCases = [CreateCheckoutSessionUseCase, HandleStripeWebhookUseCase];
const webhookHandlers = [
  CheckoutSessionCompletedHandler,
  CheckoutSessionExpiredHandler,
  InvoicePaymentSucceededHandler,
  InvoicePaymentFailedHandler,
];
const queries = [GetPlansQueryHandler];
const services = [StripeService];
const repositories = [SubscriptionsRepository, PaymentsRepository, CustomersRepository];
const guards = [RemoteAuthGuard];

@Module({
  imports: [OutboxModule],
  controllers: [...controllers],
  providers: [
    ...useCases,
    ...webhookHandlers,
    ...queries,
    ...services,
    ...repositories,
    ...guards,
    //todo вынести этот провайдер отдельно
    {
      provide: WEBHOOK_HANDLERS,
      useFactory: (
        CheckoutSessionCompleted: CheckoutSessionCompletedHandler,
        CheckoutSessionExpired: CheckoutSessionExpiredHandler,
        InvoicePaymentSucceeded: InvoicePaymentSucceededHandler,
        InvoicePaymentFailed: InvoicePaymentFailedHandler,
      ) => [
        CheckoutSessionCompleted,
        CheckoutSessionExpired,
        InvoicePaymentSucceeded,
        InvoicePaymentFailed,
      ],
      inject: [
        CheckoutSessionCompletedHandler,
        CheckoutSessionExpiredHandler,
        InvoicePaymentSucceededHandler,
        InvoicePaymentFailedHandler,
      ],
    },
  ],
  exports: [],
})
export class SubscriptionsModule {}
