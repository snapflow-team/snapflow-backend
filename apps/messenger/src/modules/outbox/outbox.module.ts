import { Module } from '@nestjs/common';
import { OutboxRepository } from './repositories/outbox.repository';
import { OutboxMaintenanceService } from './services/outbox-maintenance.service';
import { RabbitMQModule } from '../rabbitmq/rabbitmq.module';

@Module({
  imports: [RabbitMQModule],
  providers: [OutboxRepository, OutboxMaintenanceService],
  exports: [OutboxRepository],
})
export class OutboxModule {}
