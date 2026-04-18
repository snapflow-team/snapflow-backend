import { Plan } from '../../../../setup/configuration/business-rules-settings';
import { ApiProperty } from '@nestjs/swagger';

export class PlanViewDto {
  @ApiProperty({
    description: 'Уникальный идентификатор тарифного плана',
    example: 'plan_monthly_basic',
  })
  id: string;

  @ApiProperty({
    description: 'Человекочитаемое название плана',
    example: 'Месячная подписка (базовый тариф)',
  })
  label: string;

  @ApiProperty({
    description: 'Стоимость плана в центах (minor units)',
    example: 990,
  })
  priceInCents: number;

  static mapToView(plan: Plan): PlanViewDto {
    return {
      id: plan.id,
      label: plan.label,
      priceInCents: plan.priceInCents,
    };
  }
}
