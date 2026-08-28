import { UploadSession as PrismaUploadSession, UploadSessionStatus } from '@generated/prisma-files';
import {
  UploadSession,
  UploadSessionProps,
  UploadSessionStatus as DomainStatus,
} from '../../../domain';

const STATUS_TO_DOMAIN: Record<UploadSessionStatus, DomainStatus> = {
  ACTIVE: DomainStatus.ACTIVE,
  COMPLETED: DomainStatus.COMPLETED,
  ABORTED: DomainStatus.ABORTED,
};

const STATUS_TO_PRISMA: Record<DomainStatus, UploadSessionStatus> = {
  [DomainStatus.ACTIVE]: 'ACTIVE',
  [DomainStatus.COMPLETED]: 'COMPLETED',
  [DomainStatus.ABORTED]: 'ABORTED',
};

export interface UploadSessionParts {
  parts: Array<{ partNumber: number; etag: string; size: bigint }>;
}

export function mapUploadSessionToDomain(
  row: PrismaUploadSession,
): UploadSession & { parts: UploadSessionParts['parts'] } {
  const props: UploadSessionProps = {
    id: row.id,
    objectId: row.objectId,
    ownerUserId: row.ownerUserId,
    profile: row.profile,
    status: STATUS_TO_DOMAIN[row.status],
    declaredSize: row.declaredSize,
    declaredMime: row.declaredMime,
    chunkSize: row.chunkSize,
    storageKey: row.storageKey,
    multipartId: row.multipartId,
    receivedBytes: row.receivedBytes,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };

  const session = UploadSession.reconstitute(props);
  const parts =
    (
      row.parts as {
        parts?: Array<{ partNumber: number; etag: string; size: string | bigint }>;
      } | null
    )?.parts?.map((part) => ({
      partNumber: part.partNumber,
      etag: part.etag,
      size: typeof part.size === 'bigint' ? part.size : BigInt(part.size),
    })) ?? [];

  return Object.assign(session, { parts });
}

export function mapUploadSessionStatusToPrisma(status: DomainStatus): UploadSessionStatus {
  return STATUS_TO_PRISMA[status];
}
