import { Module } from '@nestjs/common';
import { OutboxModule } from '../outbox/outbox.module';
import { SubscriptionsController } from './api/subscriptions.controller';
import { GetPlansQueryHandler } from './application/queries/get-plans.query-handler';
import { CreateCheckoutSessionUseCase } from './application/usecases/create-checkout-session.usecase';
import { StripeService } from './application/services/stripe.service';
import { SubscriptionsRepository } from './infrastructure/subscriptions.repository';

const controllers = [SubscriptionsController];
const useCases = [CreateCheckoutSessionUseCase];
const queries = [GetPlansQueryHandler];
const services = [StripeService];
const repositories = [SubscriptionsRepository];

@Module({
  imports: [OutboxModule],
  controllers: [...controllers],
  providers: [...useCases, ...queries, ...services, ...repositories],
  exports: [],
})
export class SubscriptionsModule {}
