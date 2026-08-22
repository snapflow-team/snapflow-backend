import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PushSubscriptionsRepository } from '../../push/repositories/push-subscriptions.repository';
import { SavePushSubscriptionApplicationDto } from '../dto/save-push-subscription.application-dto';

export class SavePushSubscriptionCommand {
  constructor(public readonly dto: SavePushSubscriptionApplicationDto) {}
}

@CommandHandler(SavePushSubscriptionCommand)
export class SavePushSubscriptionUseCase implements ICommandHandler<SavePushSubscriptionCommand> {
  constructor(private readonly pushSubscriptionsRepository: PushSubscriptionsRepository) {}

  async execute({ dto }: SavePushSubscriptionCommand): Promise<void> {
    await this.pushSubscriptionsRepository.upsertByEndpoint(dto);
  }
}
