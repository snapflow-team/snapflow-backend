import { Inject, Injectable } from '@nestjs/common';
import {
  STORAGE_PROFILE_REGISTRY_INJECT_TOKEN,
  getStorageProfile,
} from './storage-profile-registry.provider';
import type { StorageProfileRegistry } from './storage-profile-registry.provider';
import { StorageProfileDefinition } from './storage-profile.types';

@Injectable()
export class StorageProfileRegistryService {
  constructor(
    @Inject(STORAGE_PROFILE_REGISTRY_INJECT_TOKEN)
    readonly registry: StorageProfileRegistry,
  ) {}

  getProfile(profileId: string): StorageProfileDefinition | undefined {
    return getStorageProfile(this.registry, profileId);
  }
}
