import { StorageSettings } from '../../../../setup/configuration/storage-settings';
import { createStorageProfileRegistry, getStorageProfile } from './storage-profile.registry';
import { STORAGE_PROFILE_IDS } from './storage-profile.types';
import {
  STORAGE_E1_DOCUMENT_MIME_TYPES,
  STORAGE_E1_IMAGE_MIME_TYPES,
  STORAGE_E2_VIDEO_MIME_TYPES,
  STORAGE_E2_VOICE_MIME_TYPES,
} from './storage-mime-whitelist';
import { StorageVariantKind } from '@contracts/storage';

function createTestStorageSettings(): StorageSettings {
  return new StorageSettings({
    NODE_ENV: 'testing',
    S3_PRIVATE_BUCKET: 'bucket',
    S3_PRIVATE_SSE_MODE: 'AES256',
    STORAGE_SIGNED_URL_TTL_SECONDS: '300',
    STORAGE_UPLOAD_SESSION_TTL_SECONDS: '86400',
    STORAGE_CHUNK_SIZE_BYTES: '5242880',
    STORAGE_ORPHAN_TTL_SECONDS: '604800',
    STORAGE_QUOTA_BYTES_PER_MINUTE: '1073741824',
    STORAGE_MAX_CONCURRENT_UPLOADS: '5',
  });
}

describe('storage profile registry', () => {
  const registry = createStorageProfileRegistry(createTestStorageSettings());

  it('exposes message_attachment profile with E1 and E2 MIME whitelist', () => {
    const profile = getStorageProfile(registry, STORAGE_PROFILE_IDS.MESSAGE_ATTACHMENT);

    expect(profile).toBeDefined();
    expect(profile?.visibility).toBe('private');
    expect(profile?.maxSizeBytes).toBe(100 * 1024 * 1024);
    expect(profile?.allowedMimeTypes).toEqual(
      expect.arrayContaining([
        ...STORAGE_E1_IMAGE_MIME_TYPES,
        ...STORAGE_E1_DOCUMENT_MIME_TYPES,
        ...STORAGE_E2_VIDEO_MIME_TYPES,
      ]),
    );
    expect(profile?.variants).toEqual([
      StorageVariantKind.ORIGINAL,
      StorageVariantKind.THUMB,
      StorageVariantKind.PREVIEW,
    ]);
  });

  it('exposes voice_message profile with audio MIME whitelist', () => {
    const profile = getStorageProfile(registry, STORAGE_PROFILE_IDS.VOICE_MESSAGE);

    expect(profile).toBeDefined();
    expect(profile?.maxSizeBytes).toBe(20 * 1024 * 1024);
    expect(profile?.allowedMimeTypes).toEqual([...STORAGE_E2_VOICE_MIME_TYPES]);
    expect(profile?.variants).toEqual([StorageVariantKind.ORIGINAL, StorageVariantKind.WAVEFORM]);
  });

  it('returns undefined for unknown profile id', () => {
    expect(getStorageProfile(registry, 'unknown_profile')).toBeUndefined();
  });
});
