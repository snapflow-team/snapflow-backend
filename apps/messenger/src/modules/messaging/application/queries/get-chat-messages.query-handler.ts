import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ForbiddenException } from '../../../../common/exceptions/domain-exceptions';
import { GetChatMessagesQueryParamsDto } from '../../api/input-dto/get-chat-messages.query-params.dto';
import { ChatMessagesPageViewDto } from '../../api/view-dto/chat-messages-page.view-dto';
import { MessageViewDto } from '../../api/view-dto/message.view-dto';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';

export class GetChatMessagesQuery {
  constructor(
    public readonly chatId: number,
    public readonly userId: number,
    public readonly query: GetChatMessagesQueryParamsDto,
  ) {}
}

@QueryHandler(GetChatMessagesQuery)
export class GetChatMessagesQueryHandler
  implements IQueryHandler<GetChatMessagesQuery, ChatMessagesPageViewDto>
{
  constructor(
    private readonly chatsRepository: ChatsRepository,
    private readonly messagesRepository: MessagesRepository,
  ) {}

  async execute({ chatId, userId, query }: GetChatMessagesQuery): Promise<ChatMessagesPageViewDto> {
    const chat = await this.chatsRepository.findById(chatId);

    if (!chat) {
      throw new ForbiddenException('Access denied');
    }

    const interlocutorId = this.chatsRepository.getInterlocutorId(chat, userId);

    const result = await this.messagesRepository.findByChatIdPaginated(chatId, {
      cursor: query.cursor,
      limit: query.limit,
    });

    const page = new ChatMessagesPageViewDto();
    page.items = result.items.map((message) =>
      MessageViewDto.mapToView(
        message,
        message.senderId === userId ? interlocutorId : userId,
      ),
    );
    page.hasMore = result.hasMore;
    page.nextCursor = result.nextCursor;

    return page;
  }
}
