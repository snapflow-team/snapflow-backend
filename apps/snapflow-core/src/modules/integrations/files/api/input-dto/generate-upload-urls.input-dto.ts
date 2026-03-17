import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MimeType } from '../../../../../../../../libs/contracts/files';

const MAX_FILES_COUNT = 10;
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024;

export class UploadFileInputDto {
  @ApiProperty({
    enum: MimeType,
    enumName: 'MimeType',
    description: 'MIME-тип файла',
  })
  @IsEnum(MimeType)
  mimeType: MimeType;

  @ApiProperty({
    example: 1024,
    minimum: 1,
    maximum: MAX_FILE_SIZE_BYTES,
    description: 'Размер файла в байтах',
  })
  @IsInt()
  @Min(1, { message: 'File size must be greater than 0' })
  @Max(MAX_FILE_SIZE_BYTES, {
    message: 'The maximum file size is 20 MB',
  })
  size: number;
}

export class GenerateUploadUrlsInputDto {
  @ApiProperty({
    type: UploadFileInputDto,
    isArray: true,
    description: 'Список файлов для генерации ссылок загрузки',
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one file is required' })
  @ArrayMaxSize(MAX_FILES_COUNT, {
    message: `You can upload up to ${MAX_FILES_COUNT} photos`,
  })
  @ValidateNested({ each: true })
  @Type(() => UploadFileInputDto)
  files: UploadFileInputDto[];
}
