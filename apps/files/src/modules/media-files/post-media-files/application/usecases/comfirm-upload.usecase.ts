import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfirmUploadApplicationDto } from '../dto/confirm-upload.application-dto';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';
import { FileStatus } from '@generated/files/prisma';

export class ConfirmUploadCommand {
  constructor(public readonly dto: ConfirmUploadApplicationDto) {}
}

@CommandHandler(ConfirmUploadCommand)
@Injectable()
export class ConfirmUploadUseCase implements ICommandHandler<ConfirmUploadCommand> {
  constructor(
    private readonly storageService: StorageService,
    private readonly filesRepository: FilesRepository,
  ) {}

  async execute({ dto: { userId, fileIds } }: ConfirmUploadCommand): Promise<void> {
    const files = await this.filesRepository.findManyByIdsAndUserId(userId, fileIds);

    if (files.length !== fileIds.length) {
      throw new NotFoundException('File not found');
    }

    for (const file of files) {
      if (file.status === FileStatus.UPLOADED) {
        continue;
      }
      const exist = await this.storageService.objectExists(file.key);
      if (!exist) {
        throw new BadRequestException('The file was not uploaded to the storage');
      }
    }

    await this.filesRepository.confirmManyUploads(fileIds);
  }
}
