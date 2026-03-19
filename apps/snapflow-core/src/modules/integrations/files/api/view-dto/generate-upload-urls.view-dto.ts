import { ApiProperty } from '@nestjs/swagger';
import { GenerateUploadUrlResponse } from '../../../../../../../../libs/contracts/files';

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
