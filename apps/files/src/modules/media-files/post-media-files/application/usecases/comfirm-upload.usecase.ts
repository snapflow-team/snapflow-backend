import { Injectable } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfirmUploadApplicationDto } from '../dto/confirm-upload.application-dto';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';
import { FileStatus } from '../../../../../../generated/prisma';
import {
  RpcBadRequestException,
  RpcNotFoundException,
} from '../../../../../common/exceptions/rpc-domain-exceptions';

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

  async execute({ dto: { userId, fileId } }: ConfirmUploadCommand): Promise<void> {
    const file = await this.filesRepository.findByIdAndUserId(fileId, userId);
    if (!file) {
      throw new RpcNotFoundException('File not found');
    }

    if (file.status === FileStatus.UPLOADED) {
      throw new RpcBadRequestException('The file has already been confirmed');
    }

    const exist = await this.storageService.objectExists(file.key);
    if (!exist) {
      throw new RpcBadRequestException('The file was not uploaded to the storage');
    }

    // 4. Подтверждаем
    await this.filesRepository.confirmUpload(fileId);
  }
}
