import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { GetPlansQuery } from '../application/queries/get-plans.query-handler';
import { PlanViewDto } from './view-dto/plan.view-dto';
import { RemoteAuthGuard } from '../../auth/guards/remote-auth.guard';
import { CreateCheckoutSessionInputDto } from './input-dto/create-checkout-session.input-dto';
import { UserContextDto } from '../../auth/guards/dto/user-context.dto';
import { ExtractUserFromRequest } from '../../auth/guards/decorators/extract-user-from-request.decorator';
import { Notification } from '../../../common/notification/notification';
import { CreateCheckoutSessionCommand } from '../application/usecases/create-checkout-session.usecase';
import { NotificationExceptionMapper } from '../../../common/notification/notification-exception.mapper';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('plans')
  async getPlans(): Promise<PlanViewDto[]> {
    return this.queryBus.execute(new GetPlansQuery());
  }

  @UseGuards(RemoteAuthGuard)
  @Post('stripe/checkout-session')
  async createCheckoutSession(
    @Body() { planId }: CreateCheckoutSessionInputDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ) {
    const notification: Notification<string> = await this.commandBus.execute<
      CreateCheckoutSessionCommand,
      Notification<string>
    >(new CreateCheckoutSessionCommand({ userId, planId }));

    if (notification.hasErrors) {
      NotificationExceptionMapper.throw(notification);
    }

    return { url: notification.value };
  }
}
