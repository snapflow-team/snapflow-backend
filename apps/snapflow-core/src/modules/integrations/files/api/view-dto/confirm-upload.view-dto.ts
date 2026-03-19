import { ConfirmUploadResponse } from '../../../../../../../../libs/contracts/files';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmUploadViewDto implements ConfirmUploadResponse {
  @ApiProperty({
    example: true,
    description: 'Флаг успешного подтверждения загрузки',
  })
  success: boolean;
}
