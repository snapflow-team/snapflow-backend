import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { HandleStripeWebhookApplicationDto } from '../dto/handele-stripe-webhook.application-dto';
import { StripeService } from '../services/stripe.service';
import { REDIS_CLIENT_INJECT_TOKEN } from '../../../../core/providers/provide-tokens/redis-client.inject-token';
import { Notification } from '../../../../common/notification/notification';
import Stripe from 'stripe';
import { StripeEvents } from '../constants/stripe-events.constants';
import { NotificationResultCode } from '../../../../common/notification/notification-result-code';
import { WEBHOOK_HANDLERS } from '../../../../core/providers/provide-tokens/webhook-handlers.inject-token';
import { WebhookHandler } from '../webhook/webhook.handler';

const SUPPORTED_WEBHOOK_EVENTS: ReadonlySet<string> = new Set([
  StripeEvents.CheckoutSessionCompleted,
  StripeEvents.CheckoutSessionExpired,
  StripeEvents.InvoicePaymentFailed,
  StripeEvents.InvoicePaymentSucceeded,
]);

export class HandleStripeWebhookCommand {
  constructor(public readonly dto: HandleStripeWebhookApplicationDto) {}
}

@CommandHandler(HandleStripeWebhookCommand)
export class HandleStripeWebhookUseCase
  implements ICommandHandler<HandleStripeWebhookCommand, Notification<void>>
{
  private readonly logger: Logger = new Logger(HandleStripeWebhookUseCase.name);

  constructor(
    private readonly stripeService: StripeService,
    @Inject(REDIS_CLIENT_INJECT_TOKEN) private readonly redis: Redis,
    @Inject(WEBHOOK_HANDLERS) private readonly handlers: WebhookHandler[],
  ) {}

  async execute({
    dto: { rawBody, signature },
  }: HandleStripeWebhookCommand): Promise<Notification<void>> {
    const stripeResult: Notification<Stripe.Event> = this.stripeService.constructEvent(
      rawBody,
      signature,
    );

    if (stripeResult.hasErrors) {
      return Notification.copyErrors(stripeResult);
    }

    const event: Stripe.Event = stripeResult.value;

    if (!SUPPORTED_WEBHOOK_EVENTS.has(event.type)) {
      this.logger.warn(
        `Unsupported webhook event type "${event.type}" (eventId=${event.id}). Skipping.`,
      );

      return Notification.ok();
    }

    // review: показать на ревью текущию реализацию идемпотентности через редис!

    const idempotencyKey: string = `stripe_webhook_processed:${event.id}`;

    const locked: string | null = await this.redis.set(idempotencyKey, '1', 'EX', 86400, 'NX');

    if (!locked) {
      this.logger.warn(`Event ${event.id} already processed. Skipping.`);
      return Notification.ok();
    }

    let result: Notification<void>;

    try {
      //Подбираем нужный хэндлер под конкретный ивент
      const handler = this.handlers.find((handler) => handler.supports(event));
      if (!handler) {
        return Notification.ok();
      }
      result = await handler.handle(event);
    } catch (error) {
      const errorMessage: string = error instanceof Error ? error.message : 'Unknown error';
      const errorStack: string | undefined = error instanceof Error ? error.stack : '';

      this.logger.error(`Failed: ${errorMessage}`, errorStack);

      await this.redis.del(idempotencyKey);

      return Notification.fail(
        NotificationResultCode.InternalServerError,
        'Internal database error during webhook processing',
      );
    }

    if (result.hasErrors) {
      await this.redis.del(idempotencyKey);

      return result;
    }

    return Notification.ok();
  }
}
