import { Controller, Post, UseGuards } from '@nestjs/common';
import { FilesService } from '../application/services/files.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import {
  JwtAuthGuard
} from '../../../../../../snapflow-core/src/modules/user-accounts/auth/domain/guards/bearer/jwt-auth.guard';

@Controller('files')
export class PostsMediaController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  @UseGuards(JwtAuthGuard)
  @MessagePattern({ cmd: 'generate_upload_url' })
  async generateUploadUrl(
    @Payload()
    data: {
      userId: number;
      mimeType: string;
      size: number;
    },
  ) {
    return this.filesService.generatePresignedUrl(data.userId, data.mimeType, data.size);
  }

  @MessagePattern({ cmd: 'confirm_upload' })
  async confirmUpload(
    @Payload()
    data: {
      userId: number;
      fileId: string;
    },
  ) {
    await this.filesService.confirmUpload(data.fileId, data.userId);
    return { success: true };
  }

  @MessagePattern({ cmd: 'validate_files' })
  async validateFiles(
    @Payload()
    data: {
      userId: number;
      fileIds: string[];
    },
  ) {
    return this.filesService.validateFilesForPost(data.userId, data.fileIds);
  }
}
