import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import configuration, { loadEnv, validate } from '../setup/configuration/configuration';

/* Глобальный модуль для провайдеров и модулей необходимых во всех частях приложения (например: LoggerService, CqrsModule, etc...) */
@Global()
@Module({
  imports: [
    CqrsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: loadEnv(),
    }),
  ],
  exports: [CqrsModule],
})
export class CoreModule {}
