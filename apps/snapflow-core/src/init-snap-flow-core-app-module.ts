import { NestFactory } from '@nestjs/core';
import { DynamicModule } from '@nestjs/common';
import { SnapflowCoreModule } from './snapflow-core.module';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './setup/configuration/configuration';
import { ApiSettings } from './setup/configuration/api-settings';

/**
 * Инициализация основного модуля с динамической конфигурацией.
 * Сначала создаётся контекст для получения конфигурации,
 * затем модуль донастраивается через forRoot().
 */
export async function initSnapFlowCoreAppModule(): Promise<DynamicModule> {
  const snapFlowCoreAppContext = await NestFactory.createApplicationContext(SnapflowCoreModule);
  const configService = snapFlowCoreAppContext.get(ConfigService<Configuration, true>);
  const apiSettings = configService.get<ApiSettings>('apiSettings');

  await snapFlowCoreAppContext.close();
  return SnapflowCoreModule.forRoot(apiSettings);
}
