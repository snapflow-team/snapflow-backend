import { Module } from '@nestjs/common';
import { OutboxRepository } from './repositories/outbox.repository';
import { OutboxProcessorService } from './services/outbox-processor.service';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [RabbitMQModule],
  providers: [OutboxRepository, OutboxProcessorService],
  // refactor: экспортировать дубликат репозитория только с необходимыми методами!
  exports: [OutboxRepository],
})
export class OutboxModule {}
