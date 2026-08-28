import {
  StorageObject as PrismaStorageObject,
  StorageObjectStatus as PrismaStorageObjectStatus,
  StorageObjectVariant as PrismaStorageObjectVariant,
} from '@generated/prisma-files';
import { StorageObjectStatus } from '@contracts/storage';
import { StorageObject, StorageObjectProps, StorageScanStatus } from '../../../domain';

export type StorageObjectWithVariants = PrismaStorageObject & {
  variants: PrismaStorageObjectVariant[];
};

const STATUS_TO_DOMAIN: Record<PrismaStorageObjectStatus, StorageObjectStatus> = {
  UPLOADING: StorageObjectStatus.UPLOADING,
  SCANNING: StorageObjectStatus.SCANNING,
  PROCESSING: StorageObjectStatus.PROCESSING,
  READY: StorageObjectStatus.READY,
  FAILED: StorageObjectStatus.FAILED,
  INFECTED: StorageObjectStatus.INFECTED,
};

const STATUS_TO_PRISMA: Record<StorageObjectStatus, PrismaStorageObjectStatus> = {
  [StorageObjectStatus.UPLOADING]: 'UPLOADING',
  [StorageObjectStatus.SCANNING]: 'SCANNING',
  [StorageObjectStatus.PROCESSING]: 'PROCESSING',
  [StorageObjectStatus.READY]: 'READY',
  [StorageObjectStatus.FAILED]: 'FAILED',
  [StorageObjectStatus.INFECTED]: 'INFECTED',
};

export function mapStorageObjectToDomain(row: PrismaStorageObject): StorageObject {
  const props: StorageObjectProps = {
    id: row.id,
    ownerUserId: row.ownerUserId,
    profile: row.profile,
    status: STATUS_TO_DOMAIN[row.status],
    sha256: row.sha256,
    byteSize: row.byteSize,
    mimeType: row.mimeType,
    originalName: row.originalName,
    width: row.width,
    height: row.height,
    durationMs: row.durationMs,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    scanStatus: row.scanStatus as StorageScanStatus | null,
    refCount: row.refCount,
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    readyAt: row.readyAt,
    deletedAt: row.deletedAt,
  };

  return StorageObject.reconstitute(props);
}

export function mapStorageObjectStatusToPrisma(
  status: StorageObjectStatus,
): PrismaStorageObjectStatus {
  return STATUS_TO_PRISMA[status];
}
