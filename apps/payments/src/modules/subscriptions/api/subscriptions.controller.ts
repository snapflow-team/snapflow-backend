import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags } from '@nestjs/swagger';
import { GetPlansQuery } from '../application/queries/get-plans.query-handler';
import { PlanViewDto } from './view-dto/plan.view-dto';
import { RemoteAuthGuard } from '../../auth/guards/remote-auth.guard';
import { CreateCheckoutSessionInputDto } from './input-dto/create-checkout-session.input-dto';
import { UserContextDto } from '../../auth/guards/dto/user-context.dto';
import { ExtractUserFromRequest } from '../../auth/guards/decorators/extract-user-from-request.decorator';
import { Notification } from '../../../common/notification/notification';
import { CreateCheckoutSessionCommand } from '../application/usecases/create-checkout-session.usecase';
import { NotificationExceptionMapper } from '../../../common/notification/notification-exception.mapper';
import { GetPlansSwagger } from './swagger/get-plans.swagger';
import { CreateCheckoutSessionSwagger } from './swagger/create-checkout-session.swagger';
import { CheckoutSessionUrlViewDto } from './view-dto/checkout-session-url.view-dto';
import { PaginatedViewDto } from '../../../../../../libs/dto/paginated.view-dto';
import { GetPaymentsQueryParams } from './input-dto/get-payments-query-params.input-dto';
import { PaymentViewDto } from './view-dto/payment.view-dto';
import { GetMyPaymentsQuery } from '../application/queries/get-my-payments.query-handler';
import { GetMyPaymentsSwagger } from './swagger/get-my-payments.swagger';
import { UpdateAutoRenewalInputDto } from './input-dto/update-auto-renewal.input-dto';
import { UpdateAutoRenewalCommand } from '../application/usecases/update-auto-renewal.usecase';
import { UpdateAutoRenewalSwagger } from './swagger/update-auto-renewal.swagger';

@ApiTags('Subscriptions')
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get('plans')
  @GetPlansSwagger()
  async getPlans(): Promise<PlanViewDto[]> {
    return this.queryBus.execute(new GetPlansQuery());
  }

  @Get('my-payments')
  @UseGuards(RemoteAuthGuard)
  @GetMyPaymentsSwagger()
  async getMyPayments(
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
    @Query() query: GetPaymentsQueryParams,
  ): Promise<PaginatedViewDto<PaymentViewDto>> {
    return this.queryBus.execute<GetMyPaymentsQuery, PaginatedViewDto<PaymentViewDto>>(
      new GetMyPaymentsQuery(userId, query),
    );
  }

  @UseGuards(RemoteAuthGuard)
  @Post('stripe/checkout-session')
  @CreateCheckoutSessionSwagger()
  async createCheckoutSession(
    @Body() { planId }: CreateCheckoutSessionInputDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<CheckoutSessionUrlViewDto> {
    const notification: Notification<string> = await this.commandBus.execute<
      CreateCheckoutSessionCommand,
      Notification<string>
    >(new CreateCheckoutSessionCommand({ userId, planId }));

    if (notification.hasErrors) {
      NotificationExceptionMapper.throw(notification);
    }

    return { url: notification.value };
  }

  @UseGuards(RemoteAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @Put(`stripe/auto-renewal`)
  @UpdateAutoRenewalSwagger()
  async updateAutoRenewal(
    @Body() { autoRenewal }: UpdateAutoRenewalInputDto,
    @ExtractUserFromRequest() { id: userId }: UserContextDto,
  ): Promise<void> {
    const notification: Notification<void> = await this.commandBus.execute(
      new UpdateAutoRenewalCommand({ autoRenewal, userId }),
    );

    if (notification.hasErrors) {
      NotificationExceptionMapper.throw(notification);
    }
    return;
  }
}
