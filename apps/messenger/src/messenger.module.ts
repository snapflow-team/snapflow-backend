import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MessengerController } from './messenger.controller';
import { MessengerService } from './messenger.service';
import { CoreModule } from './core/core.module';
import { LoggerModule } from './modules/logger/logger.module';
import { PrismaModule } from './modules/database/prisma.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { MessagingModule } from './modules/messaging/messaging.module';

@Module({
  imports: [
    CoreModule,
    LoggerModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    OutboxModule,
    MessagingModule,
  ],
  controllers: [MessengerController],
  providers: [MessengerService],
})
export class MessengerModule {}
