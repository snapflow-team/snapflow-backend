import { IsEnum, IsNumber } from 'class-validator';
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
  size: number;
}
