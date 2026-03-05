import { DynamicModule, Module } from '@nestjs/common';
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

/* Основной модуль Snapflow Core (Users, Auth, Posts) */
@Module({
  imports: [
    CoreModule,
    PrismaModule,
    UserAccountsModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService<Configuration, true>) => [
        configService.get<ApiSettings>('apiSettings').getThrottleOptions(),
      ],
    }),
  ],
  controllers: [SnapflowCoreController],
  providers: [SnapflowCoreService],
})
export class SnapflowCoreModule {
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
