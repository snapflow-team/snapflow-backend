import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { File, FileStatus, Prisma } from '../../../../../../generated/prisma/index';
import FileCreateInput = Prisma.FileCreateInput;

@Injectable()
export class FilesRepository {
  constructor(public readonly prisma: PrismaService) {}

  async createPending(data: FileCreateInput): Promise<void> {
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

  async confirmUpload(fileId: string) {
    return this.prisma.file.update({
      where: { id: fileId },
      data: { status: FileStatus.UPLOADED },
    });
  }

  async findManyByIdsAndUserId(userId: number, fileIds: string[]): Promise<File[]> {
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
