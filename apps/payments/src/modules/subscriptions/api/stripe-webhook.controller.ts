import type { RawBodyRequest } from '@nestjs/common';
import { Controller, Headers, Post, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { BadRequestException } from '../../../common/exceptions/domain-exceptions';
import { HandleStripeWebhookCommand } from '../application/usecases/handle-stripe-webhook.usecase';
import { NotificationExceptionMapper } from '../../../common/notification/notification-exception.mapper';
import { Notification } from '../../../common/notification/notification';

@Controller('api/v1/payments/stripe')
export class StripeWebhookController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('webhook')
  async handleWebhook(
    @Headers('stripe-signature') signature: string,
    @Req() req: RawBodyRequest<Request>,
  ) {
    if (!signature) {
      throw new BadRequestException('Missing stripe-signature header');
    }

    if (!req.rawBody) {
      throw new BadRequestException('Raw body is not available');
    }

    const result: Notification = await this.commandBus.execute(
      new HandleStripeWebhookCommand({ rawBody: req.rawBody, signature: signature }),
    );

    if (result.hasErrors) {
      NotificationExceptionMapper.throw(result);
    }

    return { received: true };
  }
}
