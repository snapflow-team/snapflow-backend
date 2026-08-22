import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Chat, ChatReadState, Message, MessageDelivery } from '@generated/prisma-messenger';
import { MessengerWsEvent } from '@contracts/messenger';
import {
  ForbiddenException,
  InternalServerException,
  NotFoundException,
} from '../../../../common/exceptions/domain-exceptions';
import { MessengerResultCode } from '../../../../common/notification/messenger-result-code';
import { Configuration } from '../../../../setup/configuration/configuration';
import { BusinessRulesSettings } from '../../../../setup/configuration/business-rules-settings';
import { MessageViewDto } from '../../sharing/api/view-dto/message.view-dto';
import { EditMessageCommand } from '../commands/edit-message.command';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { MessengerWebSocketService } from '../../realtime/services/messenger-websocket.service';

@CommandHandler(EditMessageCommand)
export class EditMessageUseCase implements ICommandHandler<EditMessageCommand, MessageViewDto> {
  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly chatsRepository: ChatsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly messengerWebSocketService: MessengerWebSocketService,
  ) {}

  async execute({ dto }: EditMessageCommand): Promise<MessageViewDto> {
    const message: Message | null = await this.messagesRepository.findById(dto.messageId);

    if (!message) {
      throw new NotFoundException('Message not found', MessengerResultCode.MessageNotFound);
    }

    if (message.senderId !== dto.editorId) {
      throw new ForbiddenException('Only the author can edit the message');
    }

    if (message.deletedForEveryone) {
      throw new ForbiddenException('Cannot edit a deleted message');
    }

    const editWindowMs: number =
      this.configService.get<BusinessRulesSettings>('businessRulesSettings').messageEditWindowMs;

    if (Date.now() - message.createdAt.getTime() > editWindowMs) {
      throw new ForbiddenException('Edit window expired', MessengerResultCode.EditWindowExpired);
    }

    const chat: Chat | null = await this.chatsRepository.findById(message.chatId);

    if (!chat) {
      throw new InternalServerException(`Chat was not found for chatId=${message.chatId}`);
    }

    const peerId: number = this.chatsRepository.getInterlocutorId(chat, dto.editorId);
    const editedAt = new Date();
    const updatedMessage: Message = await this.messagesRepository.updateText(
      dto.messageId,
      dto.text,
      editedAt,
    );

    const [peerReadState, delivery]: [ChatReadState | null, MessageDelivery | null] =
      await Promise.all([
        this.chatsRepository.findReadState(message.chatId, peerId),
        this.messagesRepository.findDelivery(dto.messageId, peerId),
      ]);

    const authorView: MessageViewDto = MessageViewDto.mapToView(updatedMessage, peerId, {
      viewerId: dto.editorId,
      deliveredToPeer: delivery != null,
      peerLastReadMessageId: peerReadState?.lastReadMessageId,
    });
    const peerView: MessageViewDto = MessageViewDto.mapToView(updatedMessage, peerId, {
      viewerId: peerId,
    });

    this.messengerWebSocketService.emitToUser(
      dto.editorId,
      MessengerWsEvent.MessageUpdated,
      authorView,
    );
    this.messengerWebSocketService.emitToUser(peerId, MessengerWsEvent.MessageUpdated, peerView);

    return authorView;
  }
}
