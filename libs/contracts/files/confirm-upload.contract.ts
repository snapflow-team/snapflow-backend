import { IsNumber, IsUUID } from 'class-validator';

export interface ConfirmUploadRequest {
  userId: number;
  fileId: string;
}

export interface ConfirmUploadResponse {
  success: boolean;
}

export class ConfirmUploadInputDto implements ConfirmUploadRequest {
  @IsNumber()
  userId: number;

  @IsUUID()
  fileId: string;
}
