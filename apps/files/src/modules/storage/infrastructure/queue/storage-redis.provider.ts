import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { Configuration } from '../../../../setup/configuration/configuration';
import { StorageQueueSettings } from '../../../../setup/configuration/storage-queue-settings';
import { STORAGE_REDIS } from './storage-queue.constants';

export const storageRedisProvider: Provider = {
  provide: STORAGE_REDIS,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<Configuration, true>): Redis => {
    const queueSettings = configService.get<StorageQueueSettings>('storageQueueSettings');

    return new Redis(queueSettings.redisUrl, {
      maxRetriesPerRequest: null,
    });
  },
};
