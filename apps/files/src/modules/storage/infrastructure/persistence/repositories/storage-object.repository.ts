import { Injectable } from '@nestjs/common';
import { Prisma, StorageObjectStatus as PrismaStorageObjectStatus } from '@generated/prisma-files';
import { StorageVariantKind } from '@contracts/storage';
import { PrismaService } from '../../../../../database/prisma.service';
import { StorageObject } from '../../../domain';
import {
  mapStorageObjectStatusToPrisma,
  mapStorageObjectToDomain,
  StorageObjectWithVariants,
} from '../mappers/storage-object.mapper';

export interface VariantRecord {
  id: string;
  objectId: string;
  kind: StorageVariantKind;
  key: string;
  mimeType: string;
  byteSize: bigint;
  width: number | null;
  height: number | null;
  durationMs: number | null;
}

@Injectable()
export class StorageObjectRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(object: StorageObject, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    const snapshot = object.snapshot;

    await tx.storageObject.upsert({
      where: { id: snapshot.id },
      create: {
        id: snapshot.id,
        ownerUserId: snapshot.ownerUserId,
        profile: snapshot.profile,
        status: mapStorageObjectStatusToPrisma(snapshot.status),
        sha256: snapshot.sha256,
        byteSize: snapshot.byteSize,
        mimeType: snapshot.mimeType,
        originalName: snapshot.originalName,
        width: snapshot.width,
        height: snapshot.height,
        durationMs: snapshot.durationMs,
        metadata: (snapshot.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        scanStatus: snapshot.scanStatus,
        refCount: snapshot.refCount,
        failureReason: snapshot.failureReason,
        readyAt: snapshot.readyAt,
        deletedAt: snapshot.deletedAt,
      },
      update: {
        status: mapStorageObjectStatusToPrisma(snapshot.status),
        sha256: snapshot.sha256,
        byteSize: snapshot.byteSize,
        mimeType: snapshot.mimeType,
        originalName: snapshot.originalName,
        width: snapshot.width,
        height: snapshot.height,
        durationMs: snapshot.durationMs,
        metadata: (snapshot.metadata ?? Prisma.JsonNull) as Prisma.InputJsonValue,
        scanStatus: snapshot.scanStatus,
        refCount: snapshot.refCount,
        failureReason: snapshot.failureReason,
        readyAt: snapshot.readyAt,
        deletedAt: snapshot.deletedAt,
      },
    });
  }

  async findById(id: string): Promise<StorageObject | null> {
    const row = await this.prisma.storageObject.findUnique({ where: { id } });

    return row ? mapStorageObjectToDomain(row) : null;
  }

  async findByIdWithVariants(id: string): Promise<StorageObjectWithVariants | null> {
    return this.prisma.storageObject.findUnique({
      where: { id },
      include: { variants: true },
    });
  }

  async findManyByIds(ids: string[]): Promise<StorageObject[]> {
    const rows = await this.prisma.storageObject.findMany({
      where: { id: { in: ids }, deletedAt: null },
    });

    return rows.map(mapStorageObjectToDomain);
  }

  async findManyByIdsWithVariants(ids: string[]): Promise<StorageObjectWithVariants[]> {
    return this.prisma.storageObject.findMany({
      where: { id: { in: ids }, deletedAt: null },
      include: { variants: true },
    });
  }

  async findReadyCanonical(ownerUserId: number, sha256: string): Promise<StorageObject | null> {
    const row = await this.prisma.storageObject.findFirst({
      where: {
        ownerUserId,
        sha256,
        status: PrismaStorageObjectStatus.READY,
        deletedAt: null,
      },
    });

    return row ? mapStorageObjectToDomain(row) : null;
  }

  async deleteById(id: string, tx: Prisma.TransactionClient = this.prisma): Promise<void> {
    await tx.storageObject.delete({ where: { id } });
  }

  async saveVariants(
    variants: VariantRecord[],
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    for (const variant of variants) {
      await tx.storageObjectVariant.upsert({
        where: { objectId_kind: { objectId: variant.objectId, kind: variant.kind } },
        create: {
          id: variant.id,
          objectId: variant.objectId,
          kind: variant.kind,
          key: variant.key,
          mimeType: variant.mimeType,
          byteSize: variant.byteSize,
          width: variant.width,
          height: variant.height,
          durationMs: variant.durationMs,
        },
        update: {
          key: variant.key,
          mimeType: variant.mimeType,
          byteSize: variant.byteSize,
          width: variant.width,
          height: variant.height,
          durationMs: variant.durationMs,
        },
      });
    }
  }

  async findOrphanCandidates(olderThan: Date, limit: number): Promise<StorageObject[]> {
    const rows = await this.prisma.storageObject.findMany({
      where: {
        status: PrismaStorageObjectStatus.READY,
        refCount: 0,
        deletedAt: null,
        readyAt: { lt: olderThan },
      },
      take: limit,
      orderBy: { readyAt: 'asc' },
    });

    return rows.map(mapStorageObjectToDomain);
  }
}
