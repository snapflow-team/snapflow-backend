import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { File, FileStatus, Prisma } from '@generated/prisma-files';

@Injectable()
export class FilesRepository {
  constructor(public readonly prisma: PrismaService) {}

  async createPending(data: Prisma.FileCreateInput): Promise<void> {
    await this.prisma.file.create({
      data: {
        id: data.id,
        userId: data.userId,
        key: data.key,
        mimeType: data.mimeType,
        size: data.size,
        status: FileStatus.PENDING,
      },
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

  // todo(magomed): зачем эти методы (findByIdAndUserId, confirmUpload)?
  async findByIdAndUserId(fileId: string, userId: number): Promise<File | null> {
    return this.prisma.file.findFirst({
      where: { id: fileId, userId, deletedAt: null },
    });
  }

  async confirmUpload(fileId: string): Promise<File | null> {
    return this.prisma.file.update({
      where: { id: fileId },
      data: { status: FileStatus.UPLOADED },
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

  // todo(vilyamz): после ревью, вынести в отдельный репозиторий
  async createOutboxEvent(
    type: string,
    payload: Prisma.InputJsonValue,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<void> {
    await tx.outboxEvent.create({
      data: {
        type,
        payload,
        status: 'PENDING',
      },
    });
  }
}
