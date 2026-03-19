import { DeleteFileApplicationDto } from '../dto/delete-file.application-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { S3Settings } from '../../../../setup/configuration/s3.settings';
import { DeleteFileResponse } from '../../../../../../../libs/contracts/files';

export class DeleteFileCommand {
  constructor(public readonly dto: DeleteFileApplicationDto) {}
}
// todo: внедрить паттерн Outbox / Cron
@CommandHandler(DeleteFileCommand)
export class DeleteFileUseCase implements ICommandHandler<DeleteFileCommand> {
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService<Configuration, true>,
  ) {}

  async execute({ dto: { userId, fileUrl } }: DeleteFileCommand): Promise<DeleteFileResponse> {
    const { publicBaseUrl } = this.configService.get<S3Settings>('s3Settings');

    const key: string = fileUrl.replace(`${publicBaseUrl}/`, '');

    await this.storageService.deleteFile(key);

    await this.filesRepository.softDelete(key, userId);

    return { success: true };
  }
}
