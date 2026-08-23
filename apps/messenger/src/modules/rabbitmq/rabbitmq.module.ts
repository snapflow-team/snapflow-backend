import { RabbitMQPublisherService } from './rabbitmq-publisher.service';
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  providers: [RabbitMQPublisherService],
  exports: [RabbitMQPublisherService],
})
export class RabbitMQModule {}
