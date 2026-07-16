import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Chat } from '@generated/prisma-messenger';
import { BadRequestException } from '../../../../common/exceptions/domain-exceptions';
import { PrismaService } from '../../../database/prisma.service';
import { MessageViewDto } from '../../api/view-dto/message.view-dto';
import { SendMessageApplicationDto } from '../dto/send-message.application-dto';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { CreateMessageResult } from '../../infrastructure/types/create-message-result.type';
import { MessengerWebSocketService } from '../../websocket/services/messenger-websocket.service';

export class SendMessageCommand {
  constructor(public readonly dto: SendMessageApplicationDto) {}
}

@CommandHandler(SendMessageCommand)
export class SendMessageUseCase implements ICommandHandler<SendMessageCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatsRepository: ChatsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly messengerWebSocketService: MessengerWebSocketService,
  ) {}

  async execute({ dto }: SendMessageCommand): Promise<MessageViewDto> {
    if (dto.senderId === dto.receiverId) {
      throw new BadRequestException('Cannot send message to yourself');
    }

    const chat: Chat = await this.chatsRepository.getOrCreate(dto.senderId, dto.receiverId);

    const { message, isNew }: CreateMessageResult = await this.prisma.$transaction(async (tx) => {
      const result: CreateMessageResult = await this.messagesRepository.createOrGetExisting(
        {
          chatId: chat.id,
          senderId: dto.senderId,
          text: dto.text,
          clientMessageId: dto.clientMessageId,
        },
        tx,
      );

      if (result.isNew) {
        await this.chatsRepository.updateLastMessage(
          chat.id,
          result.message.id,
          result.message.createdAt,
          tx,
        );
      }

      return result;
    });

    const messageView: MessageViewDto = MessageViewDto.mapToView(message, dto.receiverId, {
      viewerId: dto.senderId,
    });

    if (isNew) {
      this.messengerWebSocketService.sendToUser(
        dto.receiverId,
        MessageViewDto.mapToView(message, dto.receiverId, {
          viewerId: dto.receiverId,
        }),
      );
    }

    return messageView;
  }
}
