import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { SubscriptionQueueProcessor } from './processors/subscription-queue.processor';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';
import { DateService } from '../../../../../libs/common/services/date.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'subscriptions-notifications' }), RabbitMQModule],
  providers: [QueueService, SubscriptionQueueProcessor, DateService],
  exports: [QueueService],
})
export class QueueModule {}
