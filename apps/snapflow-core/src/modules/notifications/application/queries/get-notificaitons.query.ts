import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetNotificationsQueryParamsDto } from '../../api/input/get-notifications-query-params.dto';
import { NotificationsPageViewDto } from '../../api/output/notificaitonss-page-view.dto';
import { NotificationsQueryRepository } from '../../infrastructure/notifications.query-repository';

export class GetNotificationsQuery {
  constructor(
    public readonly userId: number,
    public readonly query: GetNotificationsQueryParamsDto,
  ) {}
}

@QueryHandler(GetNotificationsQuery)
export class GetNotificationsQueryHandler implements IQueryHandler<GetNotificationsQuery> {
  constructor(private readonly notificationsQueryRepository: NotificationsQueryRepository) {}

  async execute({ userId, query }: GetNotificationsQuery): Promise<NotificationsPageViewDto> {
    return this.notificationsQueryRepository.findNotifications(userId, query);
  }
}
