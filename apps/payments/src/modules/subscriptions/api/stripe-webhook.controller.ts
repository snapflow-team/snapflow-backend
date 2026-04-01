import { Controller, Headers, Post, RawBodyRequest, Req } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Request } from 'express';
import { BadRequestException } from '../../../common/exceptions/domain-exceptions';
import { HandleStripeWebhookCommand } from '../application/usecases/handle-stripe-webhook.usecase';

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

    const command = new HandleStripeWebhookCommand(req.rawBody, signature);
    const result = await this.commandBus.execute(command);

    // Stripe ожидает статус 200 OK. Если мы вернем ошибку, Stripe будет повторять отправку вебхука.
    if (result.hasErrors) {
      throw new BadRequestException(result.errors.join(', '));
    }

    return { received: true };
  }
}
