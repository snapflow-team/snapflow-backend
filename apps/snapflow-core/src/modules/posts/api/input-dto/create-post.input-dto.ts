import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform, TransformFnParams } from 'class-transformer';

export class CreatePostInputDto {
  @ApiPropertyOptional({
    type: String,
    example: 'Пост с публикацией',
    maxLength: 500,
    description: 'Текст поста (необязательно)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    type: [String],
    example: ['550e8400-e29b-41d4-a716-446655440000'],
    description: 'Список fileId для публикации поста',
    minItems: 1,
    maxItems: 10,
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @IsUUID('4', { each: true })
  @Transform(({ value }: TransformFnParams): string[] =>
    value == null ? [] : Array.isArray(value) ? value : [value],
  )
  fileIds: string[] = [];
}
