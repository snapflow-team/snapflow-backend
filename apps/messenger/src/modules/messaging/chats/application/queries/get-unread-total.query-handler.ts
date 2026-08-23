import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { UnreadCountViewDto } from '../../api/view-dto/unread-count.view-dto';
import { ChatsQueryRepository } from '../../infrastructure/query/chats.query-repository';

export class GetUnreadTotalQuery {
  constructor(public readonly userId: number) {}
}

@QueryHandler(GetUnreadTotalQuery)
export class GetUnreadTotalQueryHandler
  implements IQueryHandler<GetUnreadTotalQuery, UnreadCountViewDto>
{
  constructor(private readonly chatsQueryRepository: ChatsQueryRepository) {}

  async execute({ userId }: GetUnreadTotalQuery): Promise<UnreadCountViewDto> {
    const total: number = await this.chatsQueryRepository.getTotalUnreadCount(userId);

    return { total };
  }
}
