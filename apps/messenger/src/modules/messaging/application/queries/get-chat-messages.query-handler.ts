import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Chat } from '@generated/prisma-messenger';
import { ForbiddenException } from '../../../../common/exceptions/domain-exceptions';
import { GetChatMessagesQueryParamsDto } from '../../api/input-dto/get-chat-messages.query-params.dto';
import { ChatMessagesPageViewDto } from '../../api/view-dto/chat-messages-page.view-dto';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesQueryRepository } from '../../infrastructure/query/messages.query-repository';

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
    private readonly messagesQueryRepository: MessagesQueryRepository,
  ) {}

  async execute({ chatId, userId, query }: GetChatMessagesQuery): Promise<ChatMessagesPageViewDto> {
    const chat: Chat | null = await this.chatsRepository.findById(chatId);

    if (!chat) {
      throw new ForbiddenException('Access denied');
    }

    const interlocutorId: number = this.chatsRepository.getInterlocutorId(chat, userId);

    return this.messagesQueryRepository.findChatMessages(chatId, userId, interlocutorId, query);
  }
}
