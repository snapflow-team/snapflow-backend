import { StorageVariantKind } from '@contracts/storage';

export const STORAGE_PROFILE_IDS = {
  MESSAGE_ATTACHMENT: 'message_attachment',
  VOICE_MESSAGE: 'voice_message',
} as const;

export type StorageProfileId = (typeof STORAGE_PROFILE_IDS)[keyof typeof STORAGE_PROFILE_IDS];

export type StorageProfileVisibility = 'private';

export type StorageProfileDefinition = {
  readonly id: StorageProfileId;
  readonly visibility: StorageProfileVisibility;
  readonly maxSizeBytes: number;
  readonly allowedMimeTypes: readonly string[];
  readonly avRequired: true;
  readonly variants: readonly StorageVariantKind[];
  readonly orphanTtlSeconds: number;
  readonly quotaBytesPerMinute: number;
  readonly chunkSizeBytes: number;
  readonly uploadSessionTtlSeconds: number;
};
