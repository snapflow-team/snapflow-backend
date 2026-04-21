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

const controllers = [SubscriptionsController, StripeWebhookController];
const useCases = [CreateCheckoutSessionUseCase, HandleStripeWebhookUseCase];
const queries = [GetPlansQueryHandler];
const services = [StripeService];
const repositories = [SubscriptionsRepository, PaymentsRepository, CustomersRepository];
const guards = [RemoteAuthGuard];

@Module({
  imports: [OutboxModule],
  controllers: [...controllers],
  providers: [...useCases, ...queries, ...services, ...repositories, ...guards],
  exports: [],
})
export class SubscriptionsModule {}
