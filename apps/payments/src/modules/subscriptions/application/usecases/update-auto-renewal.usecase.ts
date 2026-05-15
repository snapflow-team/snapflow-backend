import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { StripeService } from '../services/stripe.service';
import { Notification } from '../../../../common/notification/notification';
import { SubscriptionsRepository } from '../../infrastructure/subscriptions.repository';
import { NotificationResultCode } from '../../../../common/notification/notification-result-code';
import { LoggerFactory } from '../../../logger/logger.factory';
import { ContextLogger } from '../../../logger/context-logger';
import { UpdateAutoRenewalApplicationDto } from '../dto/update-auto-renewal.application-dto';

export class UpdateAutoRenewalCommand {
  constructor(public readonly dto: UpdateAutoRenewalApplicationDto) {}
}

@CommandHandler(UpdateAutoRenewalCommand)
export class UpdateAutoRenewalUseCase
  implements ICommandHandler<UpdateAutoRenewalCommand, Notification<void>>
{
  private readonly logger: ContextLogger;
  constructor(
    private readonly stripeService: StripeService,
    private readonly subscriptionsRepository: SubscriptionsRepository,
    loggerFactory: LoggerFactory,
  ) {
    this.logger = loggerFactory.create(UpdateAutoRenewalUseCase.name);
  }

  async execute({
    dto: { autoRenewal, userId },
  }: UpdateAutoRenewalCommand): Promise<Notification<void>> {
    const localSubscription =
      await this.subscriptionsRepository.findActiveOrPastDueByUserId(userId);
    if (!localSubscription) {
      return Notification.fail(
        NotificationResultCode.BadRequest,
        'User does not have any active subscriptions',
      );
    }

    if (!localSubscription.stripeSubId) {
      this.logger.warn(
        `Subscription ${localSubscription.id} does not have stripeSubId`,
        this.execute.name,
      );
      return Notification.fail(NotificationResultCode.InternalServerError, 'Some error occurred');
    }

    //Если нам фронт прислал autoRenewal, который у нас в системе такой же, тогда ничего не меняем
    if (localSubscription.autoRenewal === autoRenewal) {
      return Notification.ok();
    }

    const stripeResult = await this.stripeService.updateAutoRenewal(
      localSubscription.stripeSubId,
      autoRenewal,
    );
    if (stripeResult.hasErrors) {
      return Notification.copyErrors(stripeResult);
    }

    try {
      await this.subscriptionsRepository.updateAutoRenewal(localSubscription.id, autoRenewal);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Some error occurred';

      this.logger.warn(
        `AutoRenewal in db was failed for subscription: ${localSubscription.id}`,
        this.execute.name,
      );
      return Notification.fail(NotificationResultCode.InternalServerError, errorMessage);
    }

    return Notification.ok();
  }
}
