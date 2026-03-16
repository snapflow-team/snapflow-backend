import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import type {
  ConfirmUploadRequest,
  ConfirmUploadResponse,
  DeleteFileRequest,
  DeleteFileResponse,
  GenerateUploadUrlResponse,
  GenerateUploadUrlsRequest,
  UploadFileRequest,
  UploadFileResponse,
  ValidateFilesRequest,
  ValidateFilesResponse,
} from '../../../../../../libs/contracts/files';
import { FilesRpcCommand } from '../../../../../../libs/contracts/files';
import { CommandBus } from '@nestjs/cqrs';
import { GeneratedUploadUrlCommand } from '../application/usecases/generate-presignet-url.usecase';
import { ConfirmUploadCommand } from '../application/usecases/comfirm-upload.usecase';
import { ValidateFilesCommand } from '../application/usecases/validate-files.usecase';
import { MimetypeAvatar } from '../../../../../../libs/contracts/files/mimetype-avatar.enum';
import { RpcBadRequestException } from '../../../common/exceptions/rpc-domain-exceptions';
import { AVATAR_IMAGE_SIZE } from '../../../../../../libs/common/constants/image-size.constants';
import { UploadAvatarCommand } from '../application/usecases/upload-avatar.usecase';
import { SerializedBuffer } from '../../../common/interfeces/serialized-buffer';
import { DeleteFileCommand } from '../application/usecases/delete-file.usecase';

@Controller()
export class MediaController {
  constructor(private readonly commandBus: CommandBus) {}

  @MessagePattern({ cmd: FilesRpcCommand.GenerateUploadUrl })
  async generateUploadUrl(
    @Payload()
    data: GenerateUploadUrlsRequest,
  ): Promise<GenerateUploadUrlResponse[]> {
    return this.commandBus.execute(new GeneratedUploadUrlCommand(data));
  }

  @MessagePattern({ cmd: FilesRpcCommand.ConfirmUpload })
  async confirmUpload(
    @Payload()
    data: ConfirmUploadRequest,
  ): Promise<ConfirmUploadResponse> {
    await this.commandBus.execute(new ConfirmUploadCommand(data));
    return { success: true };
  }

  @MessagePattern({ cmd: FilesRpcCommand.ValidateFiles })
  async validateFiles(
    @Payload()
    data: ValidateFilesRequest,
  ): Promise<ValidateFilesResponse> {
    return this.commandBus.execute(new ValidateFilesCommand(data));
  }

  @MessagePattern({ cmd: FilesRpcCommand.UploadFile })
  async uploadAvatar(
    @Payload()
    data: UploadFileRequest,
  ): Promise<UploadFileResponse> {
    const allowedTypes = Object.values(MimetypeAvatar) as string[];
    const imageBuffer = Buffer.isBuffer(data.buffer)
      ? data.buffer
      : Buffer.from((data.buffer as unknown as SerializedBuffer).data);

    if (!allowedTypes.includes(data.mimetype)) {
      throw new RpcBadRequestException(
        `Unsupported file type: ${data.mimetype}. Allowed: ${allowedTypes.join(', ')}`,
      );
    }

    if (data.size > AVATAR_IMAGE_SIZE) {
      const limitMb: number = AVATAR_IMAGE_SIZE / (1024 * 1024);
      const actualMb: string = (data.size / (1024 * 1024)).toFixed(2);

      throw new RpcBadRequestException(
        `File is too large. Maximum allowed size is ${limitMb}MB, but received ${actualMb}MB.`,
      );
    }

    return await this.commandBus.execute(
      new UploadAvatarCommand({
        userId: data.userId,
        mimetype: data.mimetype,
        buffer: imageBuffer,
      }),
    );
  }

  @MessagePattern({ cmd: FilesRpcCommand.DeleteFile })
  async deleteFile(@Payload() data: DeleteFileRequest): Promise<DeleteFileResponse> {
    return this.commandBus.execute(new DeleteFileCommand(data));
  }
}
