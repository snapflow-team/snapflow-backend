import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CursorQueryParamsDto {
  @ApiPropertyOptional({
    description: 'Первый запрос без cursor, далее передавать nextCursor из предыдущего ответа',
  })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ example: 8, default: 8 })
  @Type(() => Number)
  @IsOptional()
  @IsNumber()
  @Min(1)
  limit: number = 8;
}
