import { ApiProperty } from '@nestjs/swagger';

export interface ConfirmUploadRequest {
  userId: number;
  fileIds: string[];
}

export interface ConfirmUploadResponse {
  success: boolean;
}

// TODO Вынести в files
export class ConfirmUploadViewDto implements ConfirmUploadResponse {
  @ApiProperty({
    example: true,
    description: 'Флаг успешного подтверждения загрузки',
  })
  success: boolean;
}
