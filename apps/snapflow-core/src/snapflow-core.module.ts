import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { SnapflowCoreController } from './snapflow-core.controller';
import { SnapflowCoreService } from './snapflow-core.service';
import { CoreModule } from './core/core.module';
import { UserAccountsModule } from './modules/user-accounts/user-accounts.module';
import { PrismaModule } from './database/prisma.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { ApiSettings } from './setup/configuration/api-settings';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './setup/configuration/configuration';
import { NextjsIntegrationModule } from './modules/integrations/nextjs/nextjs-integration.module';
import { PostsModule } from './modules/posts/posts.module';
import { PaymentsEventsModule } from './modules/integrations/payments/payments-events.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { CryptoService } from '../../../libs/common/services/crypto.service';
import { LoggerModule } from './modules/logger/logger.module';

/* Основной модуль Snapflow Core (Users, Auth, Posts) */
@Module({
  imports: [
    CoreModule,
    LoggerModule,
    PrismaModule,
    UserAccountsModule,
    PostsModule,
    NextjsIntegrationModule,
    PaymentsEventsModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Configuration, true>) => [
        configService.get<ApiSettings>('apiSettings').getThrottleOptions(),
      ],
    }),
  ],
  controllers: [SnapflowCoreController],
  providers: [SnapflowCoreService, RequestContextMiddleware, CryptoService],
})
export class SnapflowCoreModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes({ path: '*', method: RequestMethod.ALL });
  }

  /**
   * Динамическая конфигурация модуля
   *
   * @example
   * ```typescript
   * @Module({
   *   imports: [
   *     SnapflowCoreModule.forRoot({
   *       apiKey: 'your-api-key',
   *       // ... другие параметры
   *     })
   *   ]
   * })
   * export class AppModule {}
   */
  static async forRoot(apiSettings: ApiSettings): Promise<DynamicModule> {
    //todo: добавить динамический TestingModule
    return {
      module: SnapflowCoreModule,
      imports: [],
    };
  }
}
