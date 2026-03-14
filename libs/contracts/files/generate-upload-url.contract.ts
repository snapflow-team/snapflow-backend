import { MimeType } from './mime-type.enum';
import { ApiProperty } from '@nestjs/swagger';

export interface UploadFileRequestForGenerateUploadUrls {
  mimeType: MimeType;
  size: number;
}

export interface GenerateUploadUrlsRequest {
  userId: number;
  files: UploadFileRequestForGenerateUploadUrls[];
}

export interface GenerateUploadUrlResponse {
  uploadUrl: string;
  fileId: string;
}

// TODO Вынести в files

export class GenerateUploadUrlViewDto implements GenerateUploadUrlResponse {
  @ApiProperty({
    format: 'uri',
    description: 'Подписанная ссылка для загрузки файла',
    example: 'https://storage/...signed-url',
  })
  uploadUrl: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Идентификатор файла',
  })
  fileId: string;
}
