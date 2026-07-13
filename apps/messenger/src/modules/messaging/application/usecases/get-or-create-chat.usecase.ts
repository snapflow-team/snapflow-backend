import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  BadRequestException,
  InternalServerException,
} from '../../../../common/exceptions/domain-exceptions';
import { ChatViewDto } from '../../api/view-dto/chat.view-dto';
import { GetOrCreateChatApplicationDto } from '../dto/get-or-create-chat.application-dto';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { ChatsQueryRepository } from '../../infrastructure/query/chats.query-repository';
import { Chat } from '@generated/prisma-messenger';

export class GetOrCreateChatCommand {
  constructor(public readonly dto: GetOrCreateChatApplicationDto) {}
}

@CommandHandler(GetOrCreateChatCommand)
export class GetOrCreateChatUseCase
  implements ICommandHandler<GetOrCreateChatCommand, ChatViewDto>
{
  constructor(
    private readonly chatsRepository: ChatsRepository,
    private readonly chatsQueryRepository: ChatsQueryRepository,
  ) {}

  async execute({ dto }: GetOrCreateChatCommand): Promise<ChatViewDto> {
    if (dto.userId === dto.interlocutorId) {
      throw new BadRequestException('Cannot create chat with yourself');
    }

    const chat: Chat = await this.chatsRepository.getOrCreate(dto.userId, dto.interlocutorId);

    const chatView: ChatViewDto | null = await this.chatsQueryRepository.findChatById(
      chat.id,
      dto.userId,
    );

    if (!chatView) {
      throw new InternalServerException(`Chat view was not found for chatId=${chat.id}`);
    }

    return chatView;
  }
}
