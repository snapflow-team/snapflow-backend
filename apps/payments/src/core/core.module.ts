import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import configuration, { loadEnv, validate } from '../setup/configuration/configuration';
import { RedisProvider } from './providers/redis.provider';
import { REDIS_CLIENT_INJECT_TOKEN } from './providers/provide-tokens/redis-client.inject-token';

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
  providers: [RedisProvider],
  exports: [CqrsModule, REDIS_CLIENT_INJECT_TOKEN],
})
export class CoreModule {}
