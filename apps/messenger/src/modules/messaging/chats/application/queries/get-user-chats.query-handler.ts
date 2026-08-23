import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetUserChatsQueryParamsDto } from '../../api/input-dto/get-user-chats.query-params.dto';
import { UserChatsPageViewDto } from '../../api/view-dto/user-chats-page.view-dto';
import { ChatsQueryRepository } from '../../infrastructure/query/chats.query-repository';

export class GetUserChatsQuery {
  constructor(
    public readonly userId: number,
    public readonly query: GetUserChatsQueryParamsDto,
  ) {}
}

@QueryHandler(GetUserChatsQuery)
export class GetUserChatsQueryHandler
  implements IQueryHandler<GetUserChatsQuery, UserChatsPageViewDto>
{
  constructor(private readonly chatsQueryRepository: ChatsQueryRepository) {}

  async execute({ userId, query }: GetUserChatsQuery): Promise<UserChatsPageViewDto> {
    return this.chatsQueryRepository.findUserChats(userId, query);
  }
}
