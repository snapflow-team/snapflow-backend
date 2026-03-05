import { IsEnum, IsNumber, Max } from 'class-validator';
import { MimeType } from './mime-type.enum';

export interface GenerateUploadUrlRequest {
  userId: number;
  mimeType: MimeType;
  size: number;
}

export interface GenerateUploadUrlResponse {
  uploadUrl: string;
  fileId: string;
}

export class GenerateUploadUrlInputDto implements GenerateUploadUrlRequest {
  @IsNumber()
  userId: number;

  @IsEnum(MimeType)
  mimeType: MimeType;

  @IsNumber()
  @Max(20 * 1024 * 1024, {
    message: `The maximum file size is 20 MB`,
  })
  size: number;
}
