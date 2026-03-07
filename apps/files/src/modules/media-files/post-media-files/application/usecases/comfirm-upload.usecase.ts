// import { ConfirmUploadApplicationDto } from '../dto/confirm-upload.application-dto';
// import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
// import { FilesRepository } from '../../infrastructure/repositories/files.repository';
// import { File, FileStatus } from '../../../../../../generated/prisma';
// import { StorageService } from '../../infrastructure/storage/storage.service';
// import { DomainException, DomainExceptionCode } from '../../../../../../../../libs/exceptions/http';
//
// export class ConfirmUploadCommand {
//   constructor(public readonly dto: ConfirmUploadApplicationDto) {}
// }
//
// @CommandHandler(ConfirmUploadCommand)
// export class ConfirmUploadUseCase implements ICommandHandler<ConfirmUploadCommand> {
//   constructor(
//     private readonly storageService: StorageService,
//     private readonly filesRepository: FilesRepository,
//   ) {}
//
//   async execute({ dto: { userId, fileId } }: ConfirmUploadCommand) {
//     const file: File | null = await this.filesRepository.findByIdAndUserId(fileId, userId);
//
//     if (!file) {
//       throw new DomainException({
//         code: DomainExceptionCode.NotFound,
//         message: 'File not found',
//       });
//     }
//
//     if (file.status === FileStatus.UPLOADED) {
//       throw new DomainException({
//         code: DomainExceptionCode.BadRequest,
//         message: 'The file has already been confirmed',
//       });
//     }
//
//     const exist: boolean = await this.storageService.objectExists(file.key);
//
//     if (!exist) {
//       throw new DomainException({
//         code: DomainExceptionCode.BadRequest,
//         message: 'The file was not uploaded to the storage',
//       });
//     }
//
//     await this.filesRepository.confirmUpload(fileId);
//   }
// }

import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConfirmUploadApplicationDto } from '../dto/confirm-upload.application-dto';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';
import { FileStatus } from '../../../../../../generated/prisma';

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
    // 1. Проверяем существование файла
    const file = await this.filesRepository.findByIdAndUserId(fileId, userId);
    if (!file) {
      // ← NotFoundException → RpcBadRequestFilter → RpcExceptionCode.BadRequest
      throw new NotFoundException('File not found');
    }

    // 2. Проверяем статус PENDING
    if (file.status === FileStatus.UPLOADED) {
      // ← BadRequestException → RpcBadRequestFilter → RpcExceptionCode.BadRequest
      throw new BadRequestException('The file has already been confirmed');
    }

    // 3. Проверяем наличие в S3
    const exist = await this.storageService.objectExists(file.key);
    if (!exist) {
      // ← BadRequestException → RpcBadRequestFilter → RpcExceptionCode.BadRequest
      throw new BadRequestException('The file was not uploaded to the storage');
    }

    // 4. Подтверждаем
    await this.filesRepository.confirmUpload(fileId);
  }
}
