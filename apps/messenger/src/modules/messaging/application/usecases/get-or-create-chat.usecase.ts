import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '../../../../common/exceptions/domain-exceptions';
import { ChatViewDto } from '../../api/view-dto/chat.view-dto';
import { GetOrCreateChatApplicationDto } from '../dto/get-or-create-chat.application-dto';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';

export class GetOrCreateChatCommand {
  constructor(public readonly dto: GetOrCreateChatApplicationDto) {}
}

@CommandHandler(GetOrCreateChatCommand)
export class GetOrCreateChatUseCase
  implements ICommandHandler<GetOrCreateChatCommand, ChatViewDto>
{
  constructor(
    private readonly chatsRepository: ChatsRepository,
    private readonly messagesRepository: MessagesRepository,
  ) {}

  async execute({ dto }: GetOrCreateChatCommand): Promise<ChatViewDto> {
    if (dto.userId === dto.interlocutorId) {
      throw new BadRequestException('Cannot create chat with yourself');
    }

    const chat = await this.chatsRepository.getOrCreate(dto.userId, dto.interlocutorId);
    const interlocutorId = this.chatsRepository.getInterlocutorId(chat, dto.userId);

    const lastMessage = chat.lastMessageId
      ? await this.messagesRepository.findById(chat.lastMessageId)
      : null;

    return ChatViewDto.mapToView(chat, interlocutorId, dto.userId, lastMessage);
  }
}
