import { Global, Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConfigModule } from '@nestjs/config';
import configuration, { loadEnv, validate } from '../setup/configuration/configuration';
import { RedisProvider } from './providers/redis.provider';
import { REDIS_CLIENT_INJECT_TOKEN } from './providers/provide-tokens/redis-client.inject-token';
import { HttpModule } from '@nestjs/axios';
import { NotificationResultCodeMapper } from '../common/notification/notification-result-code.mapper';
import { CryptoService } from '../../../../libs/common/services/crypto.service';

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
  providers: [NotificationResultCodeMapper, RedisProvider, CryptoService],
  exports: [
    HttpModule,
    CqrsModule,
    NotificationResultCodeMapper,
    REDIS_CLIENT_INJECT_TOKEN,
    CryptoService,
  ],
})
export class CoreModule {}
