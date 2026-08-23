import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Chat, Message } from '@generated/prisma-messenger';
import {
  MessageDeletedPayload,
  MessengerWsEvent,
} from '@contracts/messenger';
import { DeleteMessageScope } from '../../api/input-dto/delete-message.query-dto';
import {
  ForbiddenException,
  InternalServerException,
  NotFoundException,
} from '../../../../../common/exceptions/domain-exceptions';
import { MessengerResultCode } from '../../../../../common/notification/messenger-result-code';
import { Configuration } from '../../../../../setup/configuration/configuration';
import { BusinessRulesSettings } from '../../../../../setup/configuration/business-rules-settings';
import { DeleteMessageCommand } from '../commands/delete-message.command';
import { ChatsRepository } from '../../../chats/infrastructure/chats.repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { MessengerWebSocketService } from '../../../realtime/services/messenger-websocket.service';

@CommandHandler(DeleteMessageCommand)
export class DeleteMessageUseCase implements ICommandHandler<DeleteMessageCommand, void> {
  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly chatsRepository: ChatsRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly messengerWebSocketService: MessengerWebSocketService,
  ) {}

  async execute({ dto }: DeleteMessageCommand): Promise<void> {
    const message: Message | null = await this.messagesRepository.findById(dto.messageId);

    if (!message) {
      throw new NotFoundException('Message not found', MessengerResultCode.MessageNotFound);
    }

    const chat: Chat | null = await this.chatsRepository.findById(message.chatId);

    if (!chat) {
      throw new InternalServerException(`Chat was not found for chatId=${message.chatId}`);
    }

    if (dto.scope === DeleteMessageScope.Me) {
      await this.messagesRepository.upsertUserDeletion(dto.messageId, dto.userId);

      const payload: MessageDeletedPayload = {
        messageId: String(message.id),
        chatId: String(message.chatId),
        scope: DeleteMessageScope.Me,
      };
      this.messengerWebSocketService.emitToUser(
        dto.userId,
        MessengerWsEvent.MessageDeleted,
        payload,
      );
      return;
    }

    if (message.senderId !== dto.userId) {
      throw new ForbiddenException('Only the author can delete the message for everyone');
    }

    if (message.deletedForEveryone) {
      return;
    }

    const deleteWindowMs: number =
      this.configService.get<BusinessRulesSettings>(
        'businessRulesSettings',
      ).messageDeleteForEveryoneWindowMs;

    if (Date.now() - message.createdAt.getTime() > deleteWindowMs) {
      throw new ForbiddenException(
        'Delete window expired',
        MessengerResultCode.DeleteWindowExpired,
      );
    }

    const deletedAt = new Date();
    await this.messagesRepository.markDeletedForEveryone(dto.messageId, deletedAt);

    const peerId: number = this.chatsRepository.getInterlocutorId(chat, dto.userId);
    const payload: MessageDeletedPayload = {
      messageId: String(message.id),
      chatId: String(message.chatId),
      scope: DeleteMessageScope.Everyone,
    };

    this.messengerWebSocketService.emitToUser(dto.userId, MessengerWsEvent.MessageDeleted, payload);
    this.messengerWebSocketService.emitToUser(peerId, MessengerWsEvent.MessageDeleted, payload);
  }
}
