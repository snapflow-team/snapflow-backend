import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { Configuration } from '../../setup/configuration/configuration';
import { ApiSettings } from '../../setup/configuration/api-settings';
import { REDIS_CLIENT_INJECT_TOKEN } from './provide-tokens/redis-client.inject-token';

export const RedisProvider: Provider = {
  provide: REDIS_CLIENT_INJECT_TOKEN,
  inject: [ConfigService],

  useFactory: (configService: ConfigService<Configuration, true>): Redis => {
    const { redisUrl }: ApiSettings = configService.get<ApiSettings>('apiSettings');

    return new Redis(redisUrl, { lazyConnect: true });
  },
};
