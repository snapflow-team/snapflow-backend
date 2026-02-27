import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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
    @Body() dto: GetUploadInputDto,
    @ExtractUserFromRequest() user: UserContextDto,
  ) {
    return this.filesService.generatePresignedUrl(user.id, dto.mimeType, dto.size);
  }

  @Post('confirm-upload')
  @UseGuards(JwtAuthGuard) // TODO написать guard свой в сервисе
  async confirmUploadUrl(
    @Body() dto: ConfirmUploadInput,
    @ExtractUserFromRequest() user: UserContextDto,
  ) {
    return this.filesService.confirmUpload(dto.fileId, user.id);
  }

  @MessagePattern({ cmd: 'validate_files' })
  async validateFiles(@Payload() data: { userId: number; fileIds: string[] }) {
    return this.filesService.validateFilesForPost(data.userId, data.fileIds);
  }
}
