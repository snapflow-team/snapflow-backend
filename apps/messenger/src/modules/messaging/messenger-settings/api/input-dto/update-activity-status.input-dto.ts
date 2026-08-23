import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class UpdateActivityStatusInputDto {
  @IsBoolean()
  @ApiProperty({
    type: Boolean,
    description:
      'Показывать ли статус активности собеседникам. При false статус скрыт взаимно (как в Instagram).',
    example: true,
  })
  showActivityStatus: boolean;
}
