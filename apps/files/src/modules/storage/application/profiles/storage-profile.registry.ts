import { StorageVariantKind } from '@contracts/storage';
import { StorageSettings } from '../../../../setup/configuration/storage-settings';
import {
  STORAGE_MESSAGE_ATTACHMENT_MIME_TYPES,
  STORAGE_VOICE_MESSAGE_MIME_TYPES,
} from './storage-mime-whitelist';
import {
  STORAGE_PROFILE_IDS,
  StorageProfileDefinition,
  StorageProfileId,
} from './storage-profile.types';

const HUNDRED_MIB = 100 * 1024 * 1024;
const TWENTY_MIB = 20 * 1024 * 1024;

export function createStorageProfileRegistry(
  storageSettings: StorageSettings,
): ReadonlyMap<StorageProfileId, StorageProfileDefinition> {
  const profiles: StorageProfileDefinition[] = [
    {
      id: STORAGE_PROFILE_IDS.MESSAGE_ATTACHMENT,
      visibility: 'private',
      maxSizeBytes: HUNDRED_MIB,
      allowedMimeTypes: STORAGE_MESSAGE_ATTACHMENT_MIME_TYPES,
      avRequired: true,
      variants: [StorageVariantKind.ORIGINAL, StorageVariantKind.THUMB, StorageVariantKind.PREVIEW],
      orphanTtlSeconds: storageSettings.orphanTtlSeconds,
      quotaBytesPerMinute: storageSettings.quotaBytesPerMinute,
      chunkSizeBytes: storageSettings.chunkSizeBytes,
      uploadSessionTtlSeconds: storageSettings.uploadSessionTtlSeconds,
    },
    {
      id: STORAGE_PROFILE_IDS.VOICE_MESSAGE,
      visibility: 'private',
      maxSizeBytes: TWENTY_MIB,
      allowedMimeTypes: STORAGE_VOICE_MESSAGE_MIME_TYPES,
      avRequired: true,
      variants: [StorageVariantKind.ORIGINAL, StorageVariantKind.WAVEFORM],
      orphanTtlSeconds: storageSettings.orphanTtlSeconds,
      quotaBytesPerMinute: storageSettings.quotaBytesPerMinute,
      chunkSizeBytes: storageSettings.chunkSizeBytes,
      uploadSessionTtlSeconds: storageSettings.uploadSessionTtlSeconds,
    },
  ];

  return new Map(profiles.map((profile) => [profile.id, profile]));
}

export function getStorageProfile(
  registry: ReadonlyMap<StorageProfileId, StorageProfileDefinition>,
  profileId: string,
): StorageProfileDefinition | undefined {
  return registry.get(profileId as StorageProfileId);
}
