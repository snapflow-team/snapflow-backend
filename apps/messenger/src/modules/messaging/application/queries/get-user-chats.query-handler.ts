import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetUserChatsQueryParamsDto } from '../../api/input-dto/get-user-chats.query-params.dto';
import { ChatListItemViewDto } from '../../api/view-dto/chat-list-item.view-dto';
import { UserChatsPageViewDto } from '../../api/view-dto/user-chats-page.view-dto';
import { ChatsRepository } from '../../infrastructure/chats.repository';

export class GetUserChatsQuery {
  constructor(
    public readonly userId: number,
    public readonly query: GetUserChatsQueryParamsDto,
  ) {}
}

@QueryHandler(GetUserChatsQuery)
export class GetUserChatsQueryHandler implements IQueryHandler<GetUserChatsQuery, UserChatsPageViewDto> {
  constructor(private readonly chatsRepository: ChatsRepository) {}

  async execute({ userId, query }: GetUserChatsQuery): Promise<UserChatsPageViewDto> {
    const result = await this.chatsRepository.findUserChatsPaginated(userId, {
      cursor: query.cursor,
      limit: query.limit,
    });

    const page = new UserChatsPageViewDto();
    page.items = result.items.map((item) => ChatListItemViewDto.mapToView(item, userId));
    page.hasMore = result.hasMore;
    page.nextCursor = result.nextCursor;

    return page;
  }
}
