import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { Configuration } from '../../../../setup/configuration/configuration';
import { PlanViewDto } from '../../api/view-dto/plan.view-dto';
import { BusinessRulesSettings, Plan, } from 'apps/payments/src/setup/configuration/business-rules-settings';

export class GetPlansQuery {}

@QueryHandler(GetPlansQuery)
export class GetPlansQueryHandler implements IQueryHandler<GetPlansQuery, PlanViewDto[]> {
  private readonly plans: Plan[] = [];

  constructor(private readonly configService: ConfigService<Configuration, true>) {
    this.plans = configService.get<BusinessRulesSettings>('businessRulesSettings').plans;
  }

  async execute(): Promise<PlanViewDto[]> {
    return this.plans.map((p) => PlanViewDto.mapToView(p));
  }
}
