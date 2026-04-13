import { Module } from '@nestjs/common';
import { PaymentsEventsConsumer } from './payments-events.consumer';
import { PaymentsUserSyncService } from './payments-user-sync.service';
import { UserAccountsModule } from '../../user-accounts/user-accounts.module';

@Module({
  imports: [UserAccountsModule],
  providers: [PaymentsUserSyncService, PaymentsEventsConsumer],
})
export class PaymentsEventsModule {}
