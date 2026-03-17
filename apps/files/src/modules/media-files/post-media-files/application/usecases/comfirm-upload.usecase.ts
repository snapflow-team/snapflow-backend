import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfirmUploadApplicationDto } from '../dto/confirm-upload.application-dto';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';
import {
  RpcBadRequestException,
  RpcNotFoundException,
} from '../../../../../common/exceptions/rpc-domain-exceptions';
import { File, FileStatus } from '@generated/prisma-files';

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
    const files: File[] = await this.filesRepository.findManyByIdsAndUserId(userId, fileIds);

    if (files.length !== fileIds.length) {
      throw new RpcNotFoundException('File not found');
    }

    for (const file of files) {
      if (file.status === FileStatus.UPLOADED) {
        continue;
      }
      const exist = await this.storageService.objectExists(file.key);
      if (!exist) {
        throw new RpcBadRequestException('The file was not uploaded to the storage');
      }
    }

    await this.filesRepository.confirmManyUploads(fileIds);
  }
}
