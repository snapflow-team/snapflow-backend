import { NestFactory } from '@nestjs/core';
import { DynamicModule } from '@nestjs/common';
import { SnapflowCoreConfig } from './snapflow-core.config';
import { SnapflowCoreModule } from './snapflow-core.module';

/**
 * Инициализация основного модуля с динамической конфигурацией.
 * Сначала создаётся контекст для получения конфигурации,
 * затем модуль донастраивается через forRoot().
 */
export async function initSnapFlowCoreAppModule(): Promise<DynamicModule> {
  const snapFlowCoreAppContext = await NestFactory.createApplicationContext(SnapflowCoreModule);
  const snapFlowCoreAppConfig = snapFlowCoreAppContext.get<SnapflowCoreConfig>(SnapflowCoreConfig);
  await snapFlowCoreAppContext.close();
  return SnapflowCoreModule.forRoot(snapFlowCoreAppConfig);
}
