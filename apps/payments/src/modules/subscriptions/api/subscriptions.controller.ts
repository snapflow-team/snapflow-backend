import { Controller, Get } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { GetPlansQuery } from '../application/queries/get-plans.query-handler';
import { PlanViewDto } from './view-dto/plan.view-dto';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get('plans')
  async getPlans(): Promise<PlanViewDto[]> {
    return this.queryBus.execute(new GetPlansQuery());
  }
}
