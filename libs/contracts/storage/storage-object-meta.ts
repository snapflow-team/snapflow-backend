import { StorageObjectStatus } from './storage-object-status.enum';
import { StorageVariantKind } from './storage-variant-kind.enum';

export interface StorageObjectVariantMeta {
  kind: StorageVariantKind;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

/**
 * Публичные metadata объекта. Bucket, key и прочие детали хранилища сюда не входят.
 */
export interface StorageObjectMeta {
  objectId: string;
  ownerUserId: number;
  profile: string;
  status: StorageObjectStatus;
  mimeType: string | null;
  byteSize: number | null;
  originalName: string | null;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  metadata: Record<string, unknown> | null;
  variants: StorageObjectVariantMeta[];
}
