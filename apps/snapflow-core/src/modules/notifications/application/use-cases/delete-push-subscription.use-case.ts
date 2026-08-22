import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PushSubscriptionsRepository } from '../../push/push-subscriptions.repository';
import { DeletePushSubscriptionApplicationDto } from '../dto/delete-push-subscription.application-dto';

export class DeletePushSubscriptionCommand {
  constructor(public readonly dto: DeletePushSubscriptionApplicationDto) {}
}

@CommandHandler(DeletePushSubscriptionCommand)
export class DeletePushSubscriptionUseCase
  implements ICommandHandler<DeletePushSubscriptionCommand>
{
  constructor(private readonly pushSubscriptionsRepository: PushSubscriptionsRepository) {}

  async execute({ dto }: DeletePushSubscriptionCommand): Promise<void> {
    await this.pushSubscriptionsRepository.deleteByEndpoint(dto.endpoint, dto.userId);
  }
}
