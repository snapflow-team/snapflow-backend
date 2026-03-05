import { GeneratedUploadUrlApplicationDto } from '../dto/generated-upload-url.application-dto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CryptoService } from '../../../../../../../../libs/common/services/crypto.service';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../../setup/configuration/configuration';
import { S3Settings } from '../../../../../setup/configuration/s3.settings';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';
import { GenerateUploadUrlResponse } from '../../../../../../../../libs/contracts/files';

export class GeneratedUploadUrlCommand {
  constructor(public readonly dto: GeneratedUploadUrlApplicationDto) {}
}

@CommandHandler(GeneratedUploadUrlCommand)
export class GeneratedUploadUrlUseCase implements ICommandHandler<GeneratedUploadUrlCommand> {
  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly storageService: StorageService,
    private readonly cryptoService: CryptoService,
    private readonly filesRepository: FilesRepository,
  ) {}

  async execute({
    dto: { userId, mimeType, size },
  }: GeneratedUploadUrlCommand): Promise<GenerateUploadUrlResponse> {
    const { postsMediaKeyPrefix }: S3Settings = this.configService.get<S3Settings>('s3Settings');
    const fileId: string = this.cryptoService.generateUUID();
    const ext: string = mimeType.split('/')[1];
    const key: string = `${postsMediaKeyPrefix}/${userId}/${fileId}.${ext}`;

    const uploadUrl: string = await this.storageService.getPresignedPutUrl(key, mimeType, size);

    await this.filesRepository.createPending({
      id: fileId,
      userId,
      key,
      mimeType,
      size,
    });

    return { fileId, uploadUrl };
  }
}
