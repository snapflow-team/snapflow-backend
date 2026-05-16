import { Module } from '@nestjs/common';
import { InboxRepository } from './repositories/inbox.repository';
import { InboxProcessorService } from './services/inbox-processor.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [SubscriptionsModule],
  providers: [InboxRepository, InboxProcessorService],
  exports: [InboxRepository],
})
export class InboxModule {}
