import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UnreadNotificationsCountViewDto } from '../../api/output/unread-notifications-count.view-dto';
import { NotificationsQueryRepository } from '../../infrastructure/notifications.query-repository';

export class GetUnreadNotificationsCountQuery {
  constructor(public readonly userId: number) {}
}

@QueryHandler(GetUnreadNotificationsCountQuery)
export class GetUnreadNotificationsCountQueryHandler
  implements IQueryHandler<GetUnreadNotificationsCountQuery>
{
  constructor(private readonly notificationsQueryRepository: NotificationsQueryRepository) {}

  async execute({
    userId,
  }: GetUnreadNotificationsCountQuery): Promise<UnreadNotificationsCountViewDto> {
    return this.notificationsQueryRepository.getUnreadCount(userId);
  }
}
