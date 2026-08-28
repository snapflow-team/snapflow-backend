import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { StorageSettings } from '../../../../setup/configuration/storage-settings';
import { createStorageProfileRegistry, getStorageProfile } from './storage-profile.registry';
import { StorageProfileDefinition, StorageProfileId } from './storage-profile.types';

export const STORAGE_PROFILE_REGISTRY_INJECT_TOKEN = Symbol(
  'STORAGE_PROFILE_REGISTRY_INJECT_TOKEN',
);

export const StorageProfileRegistryProvider: Provider = {
  provide: STORAGE_PROFILE_REGISTRY_INJECT_TOKEN,
  inject: [ConfigService],
  useFactory: (configService: ConfigService<Configuration, true>) => {
    const storageSettings = configService.get<StorageSettings>('storageSettings');
    return createStorageProfileRegistry(storageSettings);
  },
};

export type StorageProfileRegistry = ReadonlyMap<StorageProfileId, StorageProfileDefinition>;

export { getStorageProfile };
