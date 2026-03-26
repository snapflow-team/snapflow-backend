import { Module } from '@nestjs/common';
import { SubscriptionsController } from './api/subscriptions.controller';
import { GetPlansQueryHandler } from './application/queries/get-plans.query-handler';

const controllers = [SubscriptionsController];
const queries = [GetPlansQueryHandler];

@Module({
  imports: [],
  controllers: [...controllers],
  providers: [...queries],
  exports: [],
})
export class SubscriptionsModule {}
