import { Module, forwardRef } from '@nestjs/common';
import { RemoteAuthGuard } from '../auth/guards/remote-auth.guard';
import { OutboxModule } from '../outbox/outbox.module';
import { InboxModule } from '../inbox/inbox.module';
import { SubscriptionsController } from './api/subscriptions.controller';
import { GetPlansQueryHandler } from './application/queries/get-plans.query-handler';
import { CreateCheckoutSessionUseCase } from './application/usecases/create-checkout-session.usecase';
import { StripeService } from './application/services/stripe.service';
import { SubscriptionsRepository } from './infrastructure/subscriptions.repository';
import { StripeWebhookController } from './api/stripe-webhook.controller';
import { HandleStripeWebhookUseCase } from './application/usecases/handle-stripe-webhook.usecase';
import { ReceiveStripeWebhookUseCase } from './application/usecases/receive-stripe-webhook.usecase';
import { PaymentsRepository } from './infrastructure/payments.repository';
import { CustomersRepository } from './infrastructure/customers.repository';
import { CheckoutSessionCompletedHandler } from './application/webhook/handlers/checkout-session-completed-handler';
import { CheckoutSessionExpiredHandler } from './application/webhook/handlers/checkout-session-expired-handler';
import { InvoicePaymentSucceededHandler } from './application/webhook/handlers/invoice-payment-succeeded-handler';
import { InvoicePaymentFailedHandler } from './application/webhook/handlers/invoice-payment-failed-handler';
import { WEBHOOK_HANDLERS } from '../../core/providers/provide-tokens/webhook-handlers.inject-token';
import { CustomerSubscriptionDeletedHandler } from './application/webhook/handlers/customer-subscription-deleted-handler';
import { UpdateAutoRenewalUseCase } from './application/usecases/update-auto-renewal.usecase';
import { GetMyPaymentsQueryHandler } from './application/queries/get-my-payments.query-handler';
import { PaymentsQueryRepository } from './infrastructure/query/paments.query-repository';
import { DateService } from '../../../../../libs/common/services/date.service';

const controllers = [SubscriptionsController, StripeWebhookController];
const queries = [GetPlansQueryHandler, GetMyPaymentsQueryHandler];
const useCases = [
  CreateCheckoutSessionUseCase,
  HandleStripeWebhookUseCase,
  ReceiveStripeWebhookUseCase,
  UpdateAutoRenewalUseCase,
];
const webhookHandlers = [
  CheckoutSessionCompletedHandler,
  CheckoutSessionExpiredHandler,
  InvoicePaymentSucceededHandler,
  InvoicePaymentFailedHandler,
  CustomerSubscriptionDeletedHandler,
];
const services = [StripeService, DateService];
const repositories = [
  SubscriptionsRepository,
  PaymentsRepository,
  PaymentsQueryRepository,
  CustomersRepository,
];
const guards = [RemoteAuthGuard];

@Module({
  imports: [OutboxModule, forwardRef(() => InboxModule)],
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
        CustomerSubscriptionDeleted: CustomerSubscriptionDeletedHandler,
      ) => [
        CheckoutSessionCompleted,
        CheckoutSessionExpired,
        InvoicePaymentSucceeded,
        InvoicePaymentFailed,
        CustomerSubscriptionDeleted,
      ],
      inject: [
        CheckoutSessionCompletedHandler,
        CheckoutSessionExpiredHandler,
        InvoicePaymentSucceededHandler,
        InvoicePaymentFailedHandler,
        CustomerSubscriptionDeletedHandler,
      ],
    },
  ],
  exports: [WEBHOOK_HANDLERS, StripeService],
})
export class SubscriptionsModule {}
