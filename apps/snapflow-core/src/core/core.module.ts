import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { SnapflowCoreConfig } from '../snapflow-core.config';

/* Глобальный модуль для провайдеров и модулей необходимых во всех частях приложения (например: LoggerService, CqrsModule, etc...) */
@Global()
@Module({
  imports: [CqrsModule],
  exports: [SnapflowCoreConfig, CqrsModule],
  providers: [SnapflowCoreConfig],
})
export class CoreModule {}
