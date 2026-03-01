import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { FilesService } from '../infrastructure/services/files.service';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { GetUploadInputDto } from './input-dto/get-upload.input-dto';
import { JwtAuthGuard } from '../../../snapflow-core/src/modules/user-accounts/auth/domain/guards/bearer/jwt-auth.guard';
import { ExtractUserFromRequest } from '../../../snapflow-core/src/modules/user-accounts/auth/domain/guards/decorators/extract-user-from-request.decorator';
import { UserContextDto } from '../../../snapflow-core/src/modules/user-accounts/auth/domain/guards/dto/user-context.dto';
import { ConfirmUploadInput } from './input-dto/confirm-upload.input.dto';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('upload-url')
  @UseGuards(JwtAuthGuard) // TODO написать guard свой в сервисе
  async getUploadUrl(
    @Body() { mimeType, size }: GetUploadInputDto,
    @ExtractUserFromRequest() { id }: UserContextDto,
  ) {
    // TODO вынести в dto
    return this.filesService.generatePresignedUrl(id, mimeType, size);
  }

  @Post('confirm-upload')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard) // TODO написать guard свой в сервисе
  async confirmUploadUrl(
    @Body() dto: ConfirmUploadInput,
    @ExtractUserFromRequest() { id }: UserContextDto,
  ) {
    await this.filesService.confirmUpload(dto.fileId, id);
  }

  @MessagePattern({ cmd: 'validate_files' })
  async validateFiles(@Payload() data: { userId: number; fileIds: string[] }) {
    return this.filesService.validateFilesForPost(data.userId, data.fileIds);
  }
}
