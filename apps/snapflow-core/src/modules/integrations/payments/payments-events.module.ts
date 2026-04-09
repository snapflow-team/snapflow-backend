import { Module } from '@nestjs/common';
import { PaymentsEventsConsumer } from './payments-events.consumer';
import { PaymentsUserSyncService } from './payments-user-sync.service';

@Module({
  providers: [PaymentsUserSyncService, PaymentsEventsConsumer],
})
export class PaymentsEventsModule {}
