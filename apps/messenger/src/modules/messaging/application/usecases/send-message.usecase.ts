import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException } from '../../../../common/exceptions/domain-exceptions';
import { MessageViewDto } from '../../api/view-dto/message.view-dto';
import { SendMessageApplicationDto } from '../dto/send-message.application-dto';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { MessengerWebSocketService } from '../../websocket/services/messenger-websocket.service';
import { Chat, Message } from '@generated/prisma-messenger';

export class SendMessageCommand {
  constructor(public readonly dto: SendMessageApplicationDto) {}
}

@CommandHandler(SendMessageCommand)
export class SendMessageUseCase implements ICommandHandler<SendMessageCommand> {
  constructor(
    private readonly chatsRepository: ChatsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly messengerWebSocketService: MessengerWebSocketService,
  ) {}

  async execute({ dto }: SendMessageCommand): Promise<MessageViewDto> {
    if (dto.senderId === dto.receiverId) {
      throw new BadRequestException('Cannot send message to yourself');
    }

    const chat: Chat = await this.chatsRepository.getOrCreate(dto.senderId, dto.receiverId);

    const message: Message = await this.messagesRepository.create({
      chatId: chat.id,
      senderId: dto.senderId,
      text: dto.text,
    });

    const messageView: MessageViewDto = MessageViewDto.mapToView(message, dto.receiverId);

    this.messengerWebSocketService.sendToUser(dto.receiverId, messageView);

    return messageView;
  }
}
