import { Injectable } from '@nestjs/common';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';

@Injectable()
export class PostsMediaService {
  constructor(
    private readonly storageService: StorageService,
    private readonly filesRepository: FilesRepository,
  ) {}

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
