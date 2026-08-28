import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma-files';
import { PrismaService } from '../../../../../database/prisma.service';
import { UploadSession } from '../../../domain';
import {
  mapUploadSessionStatusToPrisma,
  mapUploadSessionToDomain,
} from '../mappers/upload-session.mapper';

export interface UploadSessionRecord {
  session: UploadSession;
  parts: Array<{ partNumber: number; etag: string; size: bigint }>;
  multipartId: string | null;
  storageKey: string;
}

@Injectable()
export class UploadSessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(
    record: UploadSessionRecord,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    const snapshot = record.session.snapshot;

    await tx.uploadSession.upsert({
      where: { id: snapshot.id },
      create: {
        id: snapshot.id,
        objectId: snapshot.objectId,
        ownerUserId: snapshot.ownerUserId,
        profile: snapshot.profile,
        status: mapUploadSessionStatusToPrisma(snapshot.status),
        declaredSize: snapshot.declaredSize,
        declaredMime: snapshot.declaredMime,
        chunkSize: snapshot.chunkSize,
        storageKey: record.storageKey,
        multipartId: record.multipartId,
        receivedBytes: snapshot.receivedBytes,
        parts: {
          parts: record.parts.map((part) => ({ ...part, size: part.size.toString() })),
        } as Prisma.InputJsonValue,
        expiresAt: snapshot.expiresAt,
      },
      update: {
        status: mapUploadSessionStatusToPrisma(snapshot.status),
        receivedBytes: snapshot.receivedBytes,
        parts: {
          parts: record.parts.map((part) => ({ ...part, size: part.size.toString() })),
        } as Prisma.InputJsonValue,
        multipartId: record.multipartId,
        expiresAt: snapshot.expiresAt,
      },
    });
  }

  async findById(sessionId: string): Promise<UploadSessionRecord | null> {
    const row = await this.prisma.uploadSession.findUnique({ where: { id: sessionId } });

    if (!row) {
      return null;
    }

    const mapped = mapUploadSessionToDomain(row);

    return {
      session: mapped,
      parts: mapped.parts,
      multipartId: row.multipartId,
      storageKey: row.storageKey,
    };
  }

  async deleteById(id: string, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.uploadSession.delete({ where: { id } });
  }

  async findExpired(limit: number, now: Date = new Date()): Promise<UploadSessionRecord[]> {
    const rows = await this.prisma.uploadSession.findMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now },
      },
      take: limit,
      orderBy: { expiresAt: 'asc' },
    });

    return rows.map((row) => {
      const mapped = mapUploadSessionToDomain(row);

      return {
        session: mapped,
        parts: mapped.parts,
        multipartId: row.multipartId,
        storageKey: row.storageKey,
      };
    });
  }
}
