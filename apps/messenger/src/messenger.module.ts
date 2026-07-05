import { Module } from '@nestjs/common';
import { MessengerController } from './messenger.controller';
import { MessengerService } from './messenger.service';
import { CoreModule } from './core/core.module';
import { LoggerModule } from './modules/logger/logger.module';

@Module({
  imports: [CoreModule, LoggerModule],
  controllers: [MessengerController],
  providers: [MessengerService],
})
export class MessengerModule {}
