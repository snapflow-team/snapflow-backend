import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength } from 'class-validator';

export class UpdatePostInputDto {
  @ApiPropertyOptional({
    example: 'Пост с публикацией',
    maxLength: 500,
    description: 'Текст поста',
  })
  @IsString()
  @MaxLength(500)
  description: string;
}
