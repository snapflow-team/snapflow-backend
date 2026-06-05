import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { SubscriptionProcessor } from './processors/subscription.processor';
import { OutboxModule } from '../outbox/outbox.module';

@Module({
  //todo перераспределить зависимости нормально, Убрать отсюда outbox module
  imports: [BullModule.registerQueue({ name: 'subscriptions-notifications' }), OutboxModule],
  providers: [QueueService, SubscriptionProcessor],
  exports: [QueueService],
})
export class QueueModule {}
