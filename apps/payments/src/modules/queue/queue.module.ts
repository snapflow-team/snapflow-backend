import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { QueueService } from './queue.service';
import { SubscriptionQueueProcessor } from './processors/subscriptionQueueProcessor';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [BullModule.registerQueue({ name: 'subscriptions-notifications' }), RabbitMQModule],
  providers: [QueueService, SubscriptionQueueProcessor],
  exports: [QueueService],
})
export class QueueModule {}
