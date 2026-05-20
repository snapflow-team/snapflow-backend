import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { SubscriptionViewDto } from '../../api/view-dto/subscription.view-dto';
import { SubscriptionsQueryRepository } from '../../infrastructure/query/subscriptions.query-repository';

export class GetMyCurrentSubscriptionQuery {
  constructor(public readonly userId: number) {}
}

@QueryHandler(GetMyCurrentSubscriptionQuery)
export class GetMyCurrentSubscriptionQueryHandler
  implements IQueryHandler<GetMyCurrentSubscriptionQuery, SubscriptionViewDto | null>
{
  constructor(private readonly subscriptionsQueryRepository: SubscriptionsQueryRepository) {}

  execute({ userId }: GetMyCurrentSubscriptionQuery): Promise<SubscriptionViewDto | null> {
    return this.subscriptionsQueryRepository.findMyCurrentSubscription(userId);
  }
}
