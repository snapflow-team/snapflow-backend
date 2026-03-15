import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { FilesRepository } from '../../infrastructure/repositories/files.repository';
import { UploadFileApplicationDto } from '../dto/upload-file.application-dto';
import { UploadFileResponse } from '../../../../../../../libs/contracts/files';
import sharp, { Sharp } from 'sharp';
import { StorageService } from '../../infrastructure/storage/storage.service';
import { CryptoService } from '../../../../../../../libs/common/services/crypto.service';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { S3Settings } from '../../../../setup/configuration/s3.settings';

export class UploadAvatarCommand {
  constructor(public readonly dto: UploadFileApplicationDto) {}
}

@CommandHandler(UploadAvatarCommand)
export class UploadAvatarUseCase implements ICommandHandler<UploadAvatarCommand> {
  constructor(
    private readonly filesRepository: FilesRepository,
    private readonly configService: ConfigService<Configuration, true>,
    private readonly storageService: StorageService,
    private readonly cryptoService: CryptoService,
  ) {}

  async execute({
    dto: { userId, mimetype, buffer },
  }: UploadAvatarCommand): Promise<UploadFileResponse> {
    const ext = mimetype.split('/')[1] as 'jpeg' | 'png';

    let imageProcessor: Sharp = sharp(buffer).resize(512, 512, {
      fit: 'cover',
      position: 'center',
    });

    if (ext === 'png') {
      imageProcessor = imageProcessor.png({
        quality: 85,
        compressionLevel: 8,
      });
    } else {
      imageProcessor = imageProcessor.jpeg({
        quality: 85,
        mozjpeg: true,
      });
    }

    const processedBuffer = await imageProcessor.toBuffer();
    const finalSize: number = processedBuffer.byteLength;

    const fileId: string = this.cryptoService.generateUUID();
    const { avatarsMediaKeyPrefix }: S3Settings = this.configService.get<S3Settings>('s3Settings');
    const key = `${avatarsMediaKeyPrefix}/${userId}/${fileId}.${ext}`;

    const publicUrl: string = await this.storageService.uploadFile(key, processedBuffer, mimetype);

    await this.filesRepository.createUploaded({
      id: fileId,
      userId,
      key,
      mimeType: mimetype,
      size: finalSize,
    });

    return { key, publicUrl };
  }
}
