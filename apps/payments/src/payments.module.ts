import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { CoreModule } from './core/core.module';
import { PrismaModule } from './modules/database/prisma.module';
import { OutboxModule } from './modules/outbox/outbox.module';
import { InboxModule } from './modules/inbox/inbox.module';
import { OutboxCommandsModule } from './modules/outbox-commands/outbox-commands.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { ScheduleModule } from '@nestjs/schedule';
import { LoggerModule } from './modules/logger/logger.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './setup/configuration/configuration';
import { ApiSettings } from './setup/configuration/api-settings';

@Module({
  imports: [
    CoreModule,
    LoggerModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    OutboxModule,
    InboxModule,
    OutboxCommandsModule,
    SubscriptionsModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory(configService: ConfigService<Configuration, true>) {
        return {
          connection: {
            url: configService.get<ApiSettings>('apiSettings').redisDbUrl,
          },
        };
      },
    }),
  ],
  controllers: [PaymentsController],
  providers: [PaymentsService, RequestContextMiddleware],
})
export class PaymentsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
