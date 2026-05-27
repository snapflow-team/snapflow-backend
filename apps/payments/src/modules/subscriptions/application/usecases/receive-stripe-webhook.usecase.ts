import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import Stripe from 'stripe';
import { InboxRepository } from '../../../inbox/repositories/inbox.repository';
import { Notification } from '../../../../common/notification/notification';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { StripeService } from '../services/stripe.service';
import { ReceiveStripeWebhookApplicationDto } from '../dto/receive-stripe-webhook.application-dto';

export class ReceiveStripeWebhookCommand {
  constructor(public readonly dto: ReceiveStripeWebhookApplicationDto) {}
}

@CommandHandler(ReceiveStripeWebhookCommand)
export class ReceiveStripeWebhookUseCase
  implements ICommandHandler<ReceiveStripeWebhookCommand, Notification<void>>
{
  private readonly logger: ContextLogger;

  constructor(
    private readonly stripeService: StripeService,
    private readonly inboxRepository: InboxRepository,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(ReceiveStripeWebhookUseCase.name);
  }

  async execute({
    dto: { rawBody, signature },
  }: ReceiveStripeWebhookCommand): Promise<Notification<void>> {
    const stripeResult: Notification<Stripe.Event> = this.stripeService.constructEvent(
      rawBody,
      signature,
    );

    if (stripeResult.hasErrors) {
      return Notification.copyErrors(stripeResult);
    }

    const event: Stripe.Event = stripeResult.value;
    const inserted: boolean = await this.inboxRepository.tryInsertEvent(event);

    if (!inserted) {
      this.logger.debug(`Event ${event.id} already received. Skipping.`, this.execute.name);
    }

    return Notification.ok();
  }
}
