import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
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
}
