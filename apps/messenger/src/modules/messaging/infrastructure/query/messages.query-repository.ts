import { Injectable } from '@nestjs/common';
import { Message } from '@generated/prisma-messenger';
import {
  buildCursorPaginatedResult,
  buildKeysetCursorFilter,
  CursorPaginatedResult,
  getKeysetTake,
  KEYSET_ORDER_BY_CREATED_AT_DESC,
} from '../../../../../../../libs/common/utils/cursor-pagination.util';
import { CursorPayload, decodeCursor } from '../../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../../database/prisma.service';
import { GetChatMessagesQueryParamsDto } from '../../api/input-dto/get-chat-messages.query-params.dto';
import { ChatMessagesPageViewDto } from '../../api/view-dto/chat-messages-page.view-dto';
import { MessageViewDto } from '../../sharing/api/view-dto/message.view-dto';
import { ReplyPreviewSource } from '../../sharing/api/view-dto/reply-preview.view-dto';

@Injectable()
export class MessagesQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findChatMessages(
    chatId: number,
    userId: number,
    interlocutorId: number,
    params: GetChatMessagesQueryParamsDto,
  ): Promise<ChatMessagesPageViewDto> {
    const cursorPayload: CursorPayload | null = params.cursor ? decodeCursor(params.cursor) : null;

    const rows: Message[] = await this.prisma.message.findMany({
      where: {
        chatId,
        NOT: {
          userDeletions: {
            some: { userId },
          },
        },
        ...(cursorPayload ? buildKeysetCursorFilter(cursorPayload, { parseId: Number }) : {}),
      },
      orderBy: [...KEYSET_ORDER_BY_CREATED_AT_DESC],
      take: getKeysetTake(params.limit),
    });

    const paginated: CursorPaginatedResult<Message> = buildCursorPaginatedResult(
      rows,
      params.limit,
      (message) => ({
        createdAt: message.createdAt,
        id: String(message.id),
      }),
    );

    const [peerReadState, deliveredMessageIds, replyById] = await Promise.all([
      this.prisma.chatReadState.findUnique({
        where: {
          chatId_userId: {
            chatId,
            userId: interlocutorId,
          },
        },
        select: { lastReadMessageId: true },
      }),
      this.loadDeliveredOwnMessageIds(paginated.items, userId, interlocutorId),
      this.loadReplyPreviews(paginated.items),
    ]);

    return {
      ...paginated,
      items: paginated.items.map((message) =>
        MessageViewDto.mapToView(
          message,
          message.senderId === userId ? interlocutorId : userId,
          {
            viewerId: userId,
            peerLastReadMessageId: peerReadState?.lastReadMessageId ?? null,
            deliveredToPeer: deliveredMessageIds.has(message.id),
            replyTo: message.replyToMessageId
              ? (replyById.get(message.replyToMessageId) ?? null)
              : null,
          },
        ),
      ),
    };
  }

  private async loadDeliveredOwnMessageIds(
    messages: Message[],
    viewerId: number,
    peerId: number,
  ): Promise<Set<number>> {
    const ownMessageIds = messages
      .filter((message) => message.senderId === viewerId)
      .map((message) => message.id);

    if (ownMessageIds.length === 0) {
      return new Set();
    }

    const deliveries = await this.prisma.messageDelivery.findMany({
      where: {
        messageId: { in: ownMessageIds },
        userId: peerId,
      },
      select: { messageId: true },
    });

    return new Set(deliveries.map((delivery) => delivery.messageId));
  }

  private async loadReplyPreviews(
    messages: Message[],
  ): Promise<Map<number, ReplyPreviewSource>> {
    const replyIds = [
      ...new Set(
        messages
          .map((message) => message.replyToMessageId)
          .filter((id): id is number => id != null),
      ),
    ];

    if (replyIds.length === 0) {
      return new Map();
    }

    const replies = await this.prisma.message.findMany({
      where: { id: { in: replyIds } },
      select: {
        id: true,
        senderId: true,
        text: true,
        deletedForEveryone: true,
      },
    });

    return new Map(replies.map((reply) => [reply.id, reply]));
  }
}
