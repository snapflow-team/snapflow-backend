import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateCheckoutSessionInputDto {
  @ApiProperty({
    description: 'Идентификатор тарифного плана подписки',
    example: 'plan_monthly_basic',
  })
  @IsString()
  @IsNotEmpty()
  planId: string;
}
