import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmUploadInputDto {
  @ApiProperty({
    type: String,
    isArray: true,
    format: 'uuid',
    description: 'Список идентификаторов загруженных файлов',
    example: ['550e8400-e29b-41d4-a716-446655440000'],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID(4, { each: true })
  fileIds: string[];
}
