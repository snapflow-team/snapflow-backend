import { NestFactory } from '@nestjs/core';
import { DynamicModule, INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from './setup/configuration/configuration';
import { ApiSettings } from './setup/configuration/api-settings';
import { FilesModule } from './files.module';

/**
 * Инициализация основного модуля с динамической конфигурацией.
 * Сначала создаётся контекст для получения конфигурации,
 * затем модуль донастраивается через forRoot().
 */
export async function initFilesAppModule(): Promise<DynamicModule> {
  const filesAppContext: INestApplicationContext =
    await NestFactory.createApplicationContext(FilesModule);
  const configService: ConfigService<Configuration, true> = filesAppContext.get(
    ConfigService<Configuration, true>,
  );
  const apiSettings: ApiSettings = configService.get<ApiSettings>('apiSettings');

  await filesAppContext.close();
  return FilesModule.forRoot(apiSettings);
}
