import { StorageVariantKind } from '@contracts/storage';

const VARIANT_SUFFIX: Record<StorageVariantKind, string> = {
  [StorageVariantKind.ORIGINAL]: 'original',
  [StorageVariantKind.THUMB]: 'thumb',
  [StorageVariantKind.PREVIEW]: 'preview',
  [StorageVariantKind.POSTER]: 'poster',
  [StorageVariantKind.WAVEFORM]: 'waveform',
};

export function buildStorageObjectKey(
  objectId: string,
  suffix: string,
  now: Date = new Date(),
): string {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');

  return `messenger/${year}/${month}/${objectId}/${suffix}`;
}

export function buildVariantKey(
  objectId: string,
  kind: StorageVariantKind,
  now: Date = new Date(),
): string {
  return buildStorageObjectKey(objectId, VARIANT_SUFFIX[kind], now);
}

export function buildRawKey(objectId: string, now: Date = new Date()): string {
  return buildStorageObjectKey(objectId, 'raw', now);
}
