import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import configuration, { loadEnv, validate } from '../setup/configuration/configuration';
import { RedisProvider } from './providers/redis.provider';
import { REDIS_CLIENT_INJECT_TOKEN } from './providers/provide-tokens/redis-client.inject-token';
import { HttpModule } from '@nestjs/axios';
import { NotificationResultCodeMapper } from '../common/notification/notification-result-code.mapper';

/* Глобальный модуль для провайдеров и модулей необходимых во всех частях приложения (например: LoggerService, CqrsModule, etc...) */
@Global()
@Module({
  imports: [
    HttpModule,
    CqrsModule,
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate,
      envFilePath: loadEnv(),
    }),
  ],
  providers: [NotificationResultCodeMapper, RedisProvider],
  exports: [HttpModule, CqrsModule, NotificationResultCodeMapper, REDIS_CLIENT_INJECT_TOKEN],
})
export class CoreModule {}
