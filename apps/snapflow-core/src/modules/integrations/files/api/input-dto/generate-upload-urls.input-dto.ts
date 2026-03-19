import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsEnum, IsInt, Max, Min, ValidateNested, } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { MimeType } from '../../../../../../../../libs/contracts/files';
import {
  MAX_POST_IMAGE_COUNT,
  POST_IMAGE_SIZE,
} from '../../../../../../../../libs/common/constants/image-size.constants';

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
    maximum: POST_IMAGE_SIZE,
    description: 'Размер файла в байтах',
  })
  @IsInt()
  @Min(1, { message: 'File size must be greater than 0' })
  @Max(POST_IMAGE_SIZE, {
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
  @ArrayMaxSize(MAX_POST_IMAGE_COUNT, {
    message: `You can upload up to ${MAX_POST_IMAGE_COUNT} photos`,
  })
  @ValidateNested({ each: true })
  @Type(() => UploadFileInputDto)
  files: UploadFileInputDto[];
}
