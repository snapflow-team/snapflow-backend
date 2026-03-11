import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import {
  ConfirmUploadResponse,
  GenerateUploadUrlResponse,
} from '../../../../../../../libs/contracts/files';
import { ExtractUserFromRequest } from '../../../user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../user-accounts/auth/domain/guards/dto/user-context.dto';
import { FilesClient } from '../files.client';
import { GenerateUploadUrlsInputDto } from './input-dto/generate-upload-urls.input-dto';
import { ConfirmUploadInputDto } from './input-dto/confirm-upload-urls.input-dto';
import { GenerateUploadUrlsSwagger } from './swagger/generate-upload-urls.swagger';
import { ConfirmUploadsSwagger } from './swagger/confirm-uploads.swagger';

@Controller('media')
@UseGuards(JwtAuthGuard)
export class FilesMediaController {
  constructor(private readonly filesClient: FilesClient) {}

  @Post('upload-url')
  @HttpCode(HttpStatus.OK)
  @GenerateUploadUrlsSwagger()
  async generateUploadUrls(
    @Body() dto: GenerateUploadUrlsInputDto,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<GenerateUploadUrlResponse[]> {
    return this.filesClient.generateUploadUrl({ userId: user.id, files: dto.files });
  }

  @Post('confirm-uploads')
  @ConfirmUploadsSwagger()
  async confirmUploads(
    @Body() dto: ConfirmUploadInputDto,
    @ExtractUserFromRequest() user: UserContextDto,
  ): Promise<ConfirmUploadResponse> {
    return this.filesClient.confirmUpload({ userId: user.id, fileIds: dto.fileIds });
  }
}
