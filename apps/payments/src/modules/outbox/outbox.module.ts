import { Module } from '@nestjs/common';
import { OutboxRepository } from './repositories/outbox.repository';
import { OutboxProcessorService } from './services/outbox-processor.service';
import { RabbitMQPublisherService } from './services/rabbitmq-publisher.service';

@Module({
  providers: [OutboxRepository, RabbitMQPublisherService, OutboxProcessorService],
  // refactor: экспортировать дубликат репозитория только с необходимыми методами!
  exports: [OutboxRepository],
})
export class OutboxModule {}
