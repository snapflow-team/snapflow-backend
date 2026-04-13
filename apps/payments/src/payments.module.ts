import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CoreModule } from './core/core.module';
import { PrismaModule } from './modules/database/prisma.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [CoreModule, ScheduleModule.forRoot(), PrismaModule, OutboxModule, SubscriptionsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
