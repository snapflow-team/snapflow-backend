import type { RawBodyRequest } from '@nestjs/common';
import { Controller, Headers, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { CommandBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { BadRequestException } from '../../../common/exceptions/domain-exceptions';
import { ReceiveStripeWebhookCommand } from '../application/usecases/receive-stripe-webhook.usecase';
import { NotificationExceptionMapper } from '../../../common/notification/notification-exception.mapper';
import { Notification } from '../../../common/notification/notification';

@ApiExcludeController()
@Controller('payments/stripe')
export class StripeWebhookController {
  constructor(private readonly commandBus: CommandBus) {}

  @Post('webhook')
  @HttpCode(HttpStatus.NO_CONTENT)
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

    const result: Notification<void> = await this.commandBus.execute(
      new ReceiveStripeWebhookCommand({ rawBody: req.rawBody, signature }),
    );

    if (result.hasErrors) {
      NotificationExceptionMapper.throw(result);
    }
  }
}
