import { ConfigService } from '@nestjs/config';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Chat, Message, MessageUserDeletion, OutboxEventType } from '@generated/prisma-messenger';
import {
  ChatUpdatedPayload,
  MessengerWsEvent,
  UnreadUpdatedPayload,
} from '@contracts/messenger';
import { BadRequestException } from '../../../../../common/exceptions/domain-exceptions';
import { MessengerResultCode } from '../../../../../common/notification/messenger-result-code';
import { Configuration } from '../../../../../setup/configuration/configuration';
import { BusinessRulesSettings } from '../../../../../setup/configuration/business-rules-settings';
import { PrismaService } from '../../../../database/prisma.service';
import { OutboxRepository } from '../../../../outbox/repositories/outbox.repository';
import { MessageViewDto } from '../../../sharing/api/view-dto/message.view-dto';
import { ReplyPreviewSource } from '../../../sharing/api/view-dto/reply-preview.view-dto';
import { SendMessageApplicationDto } from '../dto/send-message.application-dto';
import { ChatsRepository } from '../../../chats/infrastructure/chats.repository';
import { ChatsQueryRepository } from '../../../chats/infrastructure/query/chats.query-repository';
import { MessagesRepository } from '../../infrastructure/messages.repository';
import { CreateMessageResult } from '../../infrastructure/types/create-message-result.type';
import { MessengerWebSocketService } from '../../../realtime/services/messenger-websocket.service';

export class SendMessageCommand {
  constructor(public readonly dto: SendMessageApplicationDto) {}
}

@CommandHandler(SendMessageCommand)
export class SendMessageUseCase implements ICommandHandler<SendMessageCommand> {
  constructor(
    private readonly configService: ConfigService<Configuration, true>,
    private readonly prisma: PrismaService,
    private readonly chatsRepository: ChatsRepository,
    private readonly chatsQueryRepository: ChatsQueryRepository,
    private readonly messagesRepository: MessagesRepository,
    private readonly outboxRepository: OutboxRepository,
    private readonly messengerWebSocketService: MessengerWebSocketService,
  ) {}

  async execute({ dto }: SendMessageCommand): Promise<MessageViewDto> {
    if (dto.senderId === dto.receiverId) {
      throw new BadRequestException('Cannot send message to yourself');
    }

    const chat: Chat = await this.chatsRepository.getOrCreate(dto.senderId, dto.receiverId);

    let validatedReplyTarget: Message | null = null;
    if (dto.replyToMessageId) {
      validatedReplyTarget = await this.resolveValidReplyTarget(
        chat.id,
        dto.senderId,
        dto.replyToMessageId,
      );
    }

    const pushDelayMs: number =
      this.configService.get<BusinessRulesSettings>('businessRulesSettings')
        .pushNotificationDelaySeconds * 1000;

    const { message, isNew }: CreateMessageResult = await this.prisma.$transaction(async (tx) => {
      const result: CreateMessageResult = await this.messagesRepository.createOrGetExisting(
        {
          chatId: chat.id,
          senderId: dto.senderId,
          text: dto.text,
          clientMessageId: dto.clientMessageId,
          ...(dto.replyToMessageId != null ? { replyToMessageId: dto.replyToMessageId } : {}),
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

        await this.outboxRepository.saveEvent(
          OutboxEventType.NEW_MESSAGE_NOTIFICATION,
          {
            chatId: chat.id,
            messageId: result.message.id,
            senderId: dto.senderId,
            recipientId: dto.receiverId,
          },
          new Date(Date.now() + pushDelayMs),
          tx,
        );
      }

      return result;
    });

    const replyTo: ReplyPreviewSource | null = await this.resolveReplyPreview(
      message.replyToMessageId,
      validatedReplyTarget,
    );

    const messageView: MessageViewDto = MessageViewDto.mapToView(message, dto.receiverId, {
      viewerId: dto.senderId,
      replyTo,
    });

    if (isNew) {
      const [unreadCount, unreadTotal] = await Promise.all([
        this.chatsQueryRepository.getUnreadCount(chat.id, dto.receiverId),
        this.chatsQueryRepository.getTotalUnreadCount(dto.receiverId),
      ]);

      this.messengerWebSocketService.sendToUser(
        dto.receiverId,
        MessageViewDto.mapToView(message, dto.receiverId, {
          viewerId: dto.receiverId,
          replyTo,
        }),
      );

      const chatUpdatedPayload: ChatUpdatedPayload = {
        chatId: String(chat.id),
        unreadCount,
      };
      const unreadUpdatedPayload: UnreadUpdatedPayload = {
        total: unreadTotal,
      };

      this.messengerWebSocketService.emitToUser(
        dto.receiverId,
        MessengerWsEvent.ChatUpdated,
        chatUpdatedPayload,
      );
      this.messengerWebSocketService.emitToUser(
        dto.receiverId,
        MessengerWsEvent.UnreadUpdated,
        unreadUpdatedPayload,
      );
    }

    return messageView;
  }

  private async resolveValidReplyTarget(
    chatId: number,
    senderId: number,
    replyToMessageId: number,
  ): Promise<Message> {
    const replyTarget: Message | null = await this.messagesRepository.findById(replyToMessageId);

    if (!replyTarget || replyTarget.chatId !== chatId) {
      throw new BadRequestException(
        'Reply target is invalid',
        MessengerResultCode.ReplyTargetInvalid,
      );
    }

    const userDeletion: MessageUserDeletion | null = await this.messagesRepository.findUserDeletion(
      replyToMessageId,
      senderId,
    );

    if (userDeletion) {
      throw new BadRequestException(
        'Reply target is hidden for the sender',
        MessengerResultCode.ReplyTargetInvalid,
      );
    }

    return replyTarget;
  }

  private async resolveReplyPreview(
    replyToMessageId: number | null,
    alreadyLoaded: Message | null,
  ): Promise<ReplyPreviewSource | null> {
    if (!replyToMessageId) {
      return null;
    }

    const replyTarget: Message | null =
      alreadyLoaded?.id === replyToMessageId
        ? alreadyLoaded
        : await this.messagesRepository.findById(replyToMessageId);

    if (!replyTarget) {
      return null;
    }

    return {
      id: replyTarget.id,
      senderId: replyTarget.senderId,
      text: replyTarget.text,
      deletedForEveryone: replyTarget.deletedForEveryone,
    };
  }
}
