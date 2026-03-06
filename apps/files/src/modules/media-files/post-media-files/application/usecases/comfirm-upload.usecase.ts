import { ConfirmUploadApplicationDto } from '../dto/confirm-upload.application-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';
import { File, FileStatus } from '../../../../../../generated/prisma';
import { DomainException } from '../../../../../../../../libs/common/exceptions/damain.exception';
import { DomainExceptionCode } from '../../../../../../../../libs/common/exceptions/types/domain-exception-codes';
import { StorageService } from '../../infrastructure/storage/storage.service';

export class ConfirmUploadCommand {
  constructor(public readonly dto: ConfirmUploadApplicationDto) {}
}

@CommandHandler(ConfirmUploadCommand)
export class ConfirmUploadUseCase implements ICommandHandler<ConfirmUploadCommand> {
  constructor(
    private readonly storageService: StorageService,
    private readonly filesRepository: FilesRepository,
  ) {}

  async execute({ dto: { userId, fileId } }: ConfirmUploadCommand) {
    const file: File | null = await this.filesRepository.findByIdAndUserId(fileId, userId);

    if (!file) {
      throw new DomainException({
        code: DomainExceptionCode.NotFound,
        message: 'File not found',
      });
    }

    if (file.status === FileStatus.UPLOADED) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'The file has already been confirmed',
      });
    }

    const exist: boolean = await this.storageService.objectExists(file.key);

    if (!exist) {
      throw new DomainException({
        code: DomainExceptionCode.BadRequest,
        message: 'The file was not uploaded to the storage',
      });
    }

    await this.filesRepository.confirmUpload(fileId);
  }
}
