import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Chat, ChatReadState, Message } from '@generated/prisma-messenger';
import {
  ChatUpdatedPayload,
  MessageReadPayload,
  MessengerWsEvent,
  UnreadUpdatedPayload,
} from '@contracts/messenger';
import { MessengerResultCode } from '../../../../../common/notification/messenger-result-code';
import {
  InternalServerException,
  NotFoundException,
} from '../../../../../common/exceptions/domain-exceptions';
import { MarkChatReadCommand } from '../commands/mark-chat-read.command';
import { ChatsRepository } from '../../infrastructure/chats.repository';
import { ChatsQueryRepository } from '../../infrastructure/query/chats.query-repository';
import { MessagesRepository } from '../../../messages/infrastructure/messages.repository';
import { ChatReadStateRepository } from '../../infrastructure/chat-read-state.repository';
import { MessengerWebSocketService } from '../../../realtime/services/messenger-websocket.service';

@CommandHandler(MarkChatReadCommand)
export class MarkChatReadUseCase implements ICommandHandler<MarkChatReadCommand, void> {
  constructor(
    private readonly chatsRepository: ChatsRepository,
    private readonly chatReadStateRepository: ChatReadStateRepository,
    private readonly chatsQueryRepository: ChatsQueryRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly messengerWebSocketService: MessengerWebSocketService,
  ) {}

  async execute({ dto }: MarkChatReadCommand): Promise<void> {
    const message: Message | null = await this.messagesRepository.findById(dto.lastReadMessageId);

    if (!message || message.chatId !== dto.chatId) {
      throw new NotFoundException('Message not found', MessengerResultCode.MessageNotFound);
    }

    const currentReadState: ChatReadState | null = await this.chatReadStateRepository.findReadState(
      dto.chatId,
      dto.readerId,
    );

    if (
      currentReadState?.lastReadMessageId != null &&
      dto.lastReadMessageId <= currentReadState.lastReadMessageId
    ) {
      return;
    }

    const readAt = new Date();

    // TODO(refactor-mark-chat-read-side-effects): upsert и WS не атомарны — при ошибке после upsert
    // (getUnreadCount / emit) клиент получит 500, а read state уже в БД; retry с тем же id — no-op без WS.
    // Варианты: conditional upsert (без даунгрейда при параллельных запросах), best-effort emit после
    // успешной записи (204 + log), outbox/retry для message.read и chat.updated.
    await this.chatReadStateRepository.upsertReadState(
      dto.chatId,
      dto.readerId,
      dto.lastReadMessageId,
      readAt,
    );

    const chat: Chat | null = await this.chatsRepository.findById(dto.chatId);

    if (!chat) {
      throw new InternalServerException(`Chat was not found for chatId=${dto.chatId}`);
    }

    const peerId: number = this.chatsRepository.getInterlocutorId(chat, dto.readerId);

    const [readerUnreadCount, peerUnreadCount, readerUnreadTotal] = await Promise.all([
      this.chatsQueryRepository.getUnreadCount(dto.chatId, dto.readerId),
      this.chatsQueryRepository.getUnreadCount(dto.chatId, peerId),
      this.chatsQueryRepository.getTotalUnreadCount(dto.readerId),
    ]);

    const messageReadPayload: MessageReadPayload = {
      chatId: String(dto.chatId),
      lastReadMessageId: String(dto.lastReadMessageId),
      readByUserId: String(dto.readerId),
      readAt: readAt.toISOString(),
    };
    const readerChatUpdatedPayload: ChatUpdatedPayload = {
      chatId: String(dto.chatId),
      unreadCount: readerUnreadCount,
    };
    const peerChatUpdatedPayload: ChatUpdatedPayload = {
      chatId: String(dto.chatId),
      unreadCount: peerUnreadCount,
    };
    const unreadUpdatedPayload: UnreadUpdatedPayload = {
      total: readerUnreadTotal,
    };

    this.messengerWebSocketService.emitToUser(
      peerId,
      MessengerWsEvent.MessageRead,
      messageReadPayload,
    );
    this.messengerWebSocketService.emitToUser(
      dto.readerId,
      MessengerWsEvent.ChatUpdated,
      readerChatUpdatedPayload,
    );
    this.messengerWebSocketService.emitToUser(
      peerId,
      MessengerWsEvent.ChatUpdated,
      peerChatUpdatedPayload,
    );
    this.messengerWebSocketService.emitToUser(
      dto.readerId,
      MessengerWsEvent.UnreadUpdated,
      unreadUpdatedPayload,
    );
  }
}
