import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';

export class MuteChatInputDto {
  @IsOptional()
  @IsDateString()
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'ISO-дата окончания mute. Если поле отсутствует или null — mute бессрочный.',
    example: '2026-08-21T12:00:00.000Z',
  })
  mutedUntil?: string | null;
}
