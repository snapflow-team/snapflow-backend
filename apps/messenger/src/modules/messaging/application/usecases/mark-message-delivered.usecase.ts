import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ChatReadState, Message } from '@generated/prisma-messenger';
import { MessengerWsEvent } from '@contracts/messenger';
import { MessengerResultCode } from '../../../../common/notification/messenger-result-code';
import { ForbiddenException, NotFoundException, } from '../../../../common/exceptions/domain-exceptions';
import { MessageViewDto } from '../../sharing/api/view-dto/message.view-dto';
import { MarkMessageDeliveredCommand } from '../commands/mark-message-delivered.command';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { MessengerWebSocketService } from '../../realtime/services/messenger-websocket.service';

@CommandHandler(MarkMessageDeliveredCommand)
export class MarkMessageDeliveredUseCase
  implements ICommandHandler<MarkMessageDeliveredCommand, void>
{
  constructor(
    private readonly chatsRepository: ChatsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly messengerWebSocketService: MessengerWebSocketService,
  ) {}

  async execute({ dto }: MarkMessageDeliveredCommand): Promise<void> {
    const message: Message | null = await this.messagesRepository.findById(dto.messageId);

    if (!message) {
      throw new NotFoundException('Message not found', MessengerResultCode.MessageNotFound);
    }

    if (message.senderId === dto.deliveredByUserId) {
      throw new ForbiddenException('Sender cannot acknowledge own message delivery');
    }

    const isParticipant: boolean = await this.chatsRepository.isParticipant(
      message.chatId,
      dto.deliveredByUserId,
    );

    if (!isParticipant) {
      throw new ForbiddenException('Access denied');
    }

    await this.messagesRepository.upsertDelivery(dto.messageId, dto.deliveredByUserId);

    const peerReadState: ChatReadState | null = await this.chatsRepository.findReadState(
      message.chatId,
      dto.deliveredByUserId,
    );

    const messageView: MessageViewDto = MessageViewDto.mapToView(message, dto.deliveredByUserId, {
      viewerId: message.senderId,
      deliveredToPeer: true,
      peerLastReadMessageId: peerReadState?.lastReadMessageId,
    });

    this.messengerWebSocketService.emitToUser(
      message.senderId,
      MessengerWsEvent.MessageUpdated,
      messageView,
    );
  }
}
