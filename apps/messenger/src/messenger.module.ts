import { Module } from '@nestjs/common';
import { MessengerController } from './messenger.controller';
import { MessengerService } from './messenger.service';
import { CoreModule } from './core/core.module';
import { LoggerModule } from './modules/logger/logger.module';
import { PrismaModule } from './modules/database/prisma.module';
import { MessagingModule } from './modules/messaging/messaging.module';

@Module({
  imports: [CoreModule, LoggerModule, PrismaModule, MessagingModule],
  controllers: [MessengerController],
  providers: [MessengerService],
})
export class MessengerModule {}
