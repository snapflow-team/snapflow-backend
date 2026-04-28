import { IsBoolean, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateAutoRenewalInputDto {
  @ApiProperty({
    description: 'Флаг автоматического продления подписки',
    example: 'false',
  })
  @IsNotEmpty()
  @IsBoolean()
  autoRenewal: boolean;
}
