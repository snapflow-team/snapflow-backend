import { ValidateFilesApplicationDto } from '../dto/validate-files.application-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';
import { File } from '@generated/prisma-files';

export class ValidateFilesCommand {
  constructor(public readonly dto: ValidateFilesApplicationDto) {}
}

@CommandHandler(ValidateFilesCommand)
export class ValidateFilesUseCase implements ICommandHandler<ValidateFilesCommand> {
  constructor(
    private readonly storageService: StorageService,
    private readonly filesRepository: FilesRepository,
  ) {}

  async execute({ dto: { userId, fileIds } }: ValidateFilesCommand) {
    if (!fileIds.length) return { valid: true, files: [] };

    const files: File[] = await this.filesRepository.findManyUploadedByIdsAndUserId(
      userId,
      fileIds,
    );

    if (files.length !== fileIds.length) {
      return { valid: false, files: [] };
    }

    const filesData = files.map((f: File) => ({
      fileId: f.id,
      url: this.storageService.getPublicUrl(f.key),
      mimeType: f.mimeType,
      size: f.size,
    }));

    return { valid: true, files: filesData };
  }
}
