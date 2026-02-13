import { DynamicModule, Module } from '@nestjs/common';
import { SnapflowCoreController } from './snapflow-core.controller';
import { SnapflowCoreService } from './snapflow-core.service';
import { snapFlowConfigDynamicModule } from './snapflow-config-dynamic-module';
import { SnapflowCoreConfig } from './snapflow-core.config';
import { CoreModule } from './core/core.module';
import { UserAccountsModule } from './modules/user-accounts/user-accounts.module';
import { PrismaModule } from './database/prisma.module';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';

/* Основной модуль Snapflow Core (Users, Auth, Posts) */
@Module({
  imports: [
    CoreModule,
    PrismaModule,
    snapFlowConfigDynamicModule,
    UserAccountsModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      inject: [SnapflowCoreConfig],
      useFactory: (coreConfig: SnapflowCoreConfig) => [
        {
          ttl: coreConfig.throttleTtl,
          limit: coreConfig.throttleLimit,
        },
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
  static async forRoot(snapFlowCoreConfig: SnapflowCoreConfig): Promise<DynamicModule> {
    //todo: добавить динамический TestingModule
    return {
      module: SnapflowCoreModule,
      imports: [],
    };
  }
}
