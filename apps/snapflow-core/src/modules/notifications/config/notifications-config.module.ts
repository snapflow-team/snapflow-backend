import { NotificationsConfig } from './notifications.config';
import { Module } from '@nestjs/common';

@Module({
  providers: [NotificationsConfig],
  exports: [NotificationsConfig],
})
export class NotificationsConfigModule {}
