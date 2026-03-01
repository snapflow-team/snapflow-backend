import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DomainException } from '../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../libs/common/exceptions/types/domain-exception-codes';
import { StorageService } from './storage.service';
import { FilesRepository } from '../repository/files.repository';

@Injectable()
export class FilesService {
  constructor(
    private readonly storageService: StorageService,
    private readonly filesRepository: FilesRepository,
  ) {}

  async generatePresignedUrl(userId: number, mimeType: string, size: number) {
    // TODO use cryptos-ervice
    const fileId = randomUUID();
    const ext = mimeType.split('/')[1] || 'bin';
    const key = `users/${userId}/${fileId}.${ext}`;

    const uploadUrl = await this.storageService.getPresignedPutUrl(key, mimeType, size);

    await this.filesRepository.createPending({
      id: fileId,
      userId,
      key,
      mimeType,
      size,
    });

    return { fileId, uploadUrl };
  }

  // для фронта после загрузки в хранилище
  async confirmUpload(fileId: string, userId: number) {
    const file = await this.filesRepository.findByIdAndUser(fileId, userId);

    if (!file || file.status !== 'PENDING') {
      // TODO разделить ошибки
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Файл не найден или уже подтвержден', // TODO ошибки на англ
      });
      // throw new BadRequestException('Файл не найден или уже подтвержден');
    }

    const exist = await this.storageService.objectExists(file.key);

    if (!exist) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'Файл не был загружен в хранилище', // TODO ошибки на англ
      });
      // throw new BadRequestException('файл не был загружен');
    }
    await this.filesRepository.confirmUpload(fileId);
  }

  async validateFilesForPost(userId: number, fileIds: string[]) {
    if (!fileIds.length) return { valid: true, files: [] };

    const files = await this.filesRepository.findManyByIdsAndUser(userId, fileIds);

    if (files.length !== fileIds.length) {
      return { valid: false, files: [] };
    }

    const filesData = files.map((f) => ({
      fileId: f.id,
      url: this.storageService.getPublicUrl(f.key),
      mimeType: f.mimeType,
      size: f.size,
    }));

    return { valid: true, files: filesData };
  }
}
