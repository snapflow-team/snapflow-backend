import { Controller } from '@nestjs/common';
import { PostsMediaService } from '../application/services/posts-media.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  ConfirmUploadInputDto,
  FilesRpcCommand,
  GenerateUploadUrlInputDto,
  ValidateFilesInputDto,
} from '../../../../../../../libs/contracts/files';

@Controller('files')
export class PostsMediaController {
  constructor(private readonly filesService: PostsMediaService) {}

  @MessagePattern({ cmd: FilesRpcCommand.GenerateUploadUrl })
  async generateUploadUrl(
    @Payload()
    data: GenerateUploadUrlInputDto,
  ) {
    return this.filesService.generatePresignedUrl(data.userId, data.mimeType, data.size);
  }

  @MessagePattern({ cmd: FilesRpcCommand.ConfirmUpload })
  async confirmUpload(
    @Payload()
    data: ConfirmUploadInputDto,
  ) {
    await this.filesService.confirmUpload(data.fileId, data.userId);
    return { success: true };
  }

  @MessagePattern({ cmd: FilesRpcCommand.ValidateFiles })
  async validateFiles(
    @Payload()
    data: ValidateFilesInputDto,
  ) {
    return this.filesService.validateFilesForPost(data.userId, data.fileIds);
  }
}
