import { Injectable } from '@nestjs/common';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';

@Injectable()
export class PostsMediaService {
  constructor(
    private readonly storageService: StorageService,
    private readonly filesRepository: FilesRepository,
  ) {}

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
