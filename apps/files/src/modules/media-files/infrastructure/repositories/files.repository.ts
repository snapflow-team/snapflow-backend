import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { File, FileStatus, Prisma } from '@generated/prisma-files';
import { CreateManyPendingFile } from './types/create-many-pending-file.type';

@Injectable()
export class FilesRepository {
  constructor(public readonly prisma: PrismaService) {}

  async createManyPending(items: CreateManyPendingFile[]): Promise<void> {
    await this.prisma.file.createMany({
      data: items.map((item) => ({
        id: item.id,
        userId: item.userId,
        key: item.key,
        mimeType: item.mimeType,
        size: item.size,
        status: FileStatus.PENDING,
      })),
    });
  }

  async createUploaded(data: Prisma.FileCreateInput): Promise<void> {
    await this.prisma.file.create({
      data: {
        id: data.id,
        userId: data.userId,
        key: data.key,
        mimeType: data.mimeType,
        size: data.size,
        status: FileStatus.UPLOADED,
      },
    });
  }

  async confirmManyUploads(fileIds: string[]): Promise<void> {
    await this.prisma.file.updateMany({
      where: {
        id: {
          in: fileIds,
        },
      },
      data: {
        status: FileStatus.UPLOADED,
      },
    });
  }

  async lockStalePendingForCleanup(thresholdMinutes: number, limit: number): Promise<File[]> {
    return this.prisma.$queryRaw<File[]>`
      UPDATE "files"
      SET
        "status" = ${FileStatus.PENDING_CLEANUP},
        "updated_at" = NOW()
      WHERE "id" IN (
        SELECT "id"
        FROM "files"
        WHERE "status" = ${FileStatus.PENDING}
          AND "deleted_at" IS NULL
          AND "created_at" < NOW() - make_interval(mins => ${thresholdMinutes})
        ORDER BY "created_at" ASC
        LIMIT ${limit}
        FOR UPDATE SKIP LOCKED
      )
      RETURNING *;
    `;
  }

  async releaseManyToPending(fileIds: string[]): Promise<void> {
    await this.prisma.file.updateMany({
      where: {
        id: {
          in: fileIds,
        },
      },
      data: {
        status: FileStatus.PENDING,
      },
    });
  }

  async recoverStaleProcessing(staleThresholdMinutes: number): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE "files"
      SET "status" = ${FileStatus.PENDING}
      WHERE "status" = ${FileStatus.PENDING_CLEANUP}
        AND "updated_at" < NOW() - make_interval(mins => ${staleThresholdMinutes});
    `;
  }

  async deleteByIds(ids: string[]): Promise<number> {
    const result = await this.prisma.file.deleteMany({
      where: {
        id: {
          in: ids,
        },
      },
    });

    return result.count;
  }

  async findManyByIdsAndUserId(userId: number, fileIds: string[]): Promise<File[]> {
    return this.prisma.file.findMany({
      where: {
        id: { in: fileIds },
        userId,
        deletedAt: null,
      },
    });
  }

  async findManyUploadedByIdsAndUserId(userId: number, fileIds: string[]): Promise<File[]> {
    return this.prisma.file.findMany({
      where: {
        id: { in: fileIds },
        userId,
        status: FileStatus.UPLOADED,
        deletedAt: null,
      },
    });
  }

  async softDelete(
    key: string,
    userId: number,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.file.updateMany({
      where: {
        key,
        userId,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }
}
