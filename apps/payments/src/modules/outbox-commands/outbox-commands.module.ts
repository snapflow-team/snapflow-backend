import { Module, forwardRef } from '@nestjs/common';
import { OutboxCommandRepository } from './repositories/outbox-command.repository';
import { OutboxCommandProcessorService } from './services/outbox-command-processor.service';
import { StripeExtendSubscriptionExecutor } from './executors/stripe-extend-subscription.executor';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [forwardRef(() => SubscriptionsModule)],
  providers: [
    OutboxCommandRepository,
    StripeExtendSubscriptionExecutor,
    OutboxCommandProcessorService,
  ],
  exports: [OutboxCommandRepository],
})
export class OutboxCommandsModule {}
