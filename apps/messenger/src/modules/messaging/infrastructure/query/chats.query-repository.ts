import { Injectable } from '@nestjs/common';
import { Prisma } from '@generated/prisma-messenger';
import {
  buildCursorPaginatedResult,
  CursorPaginatedResult,
  getKeysetTake,
} from '../../../../../../../libs/common/utils/cursor-pagination.util';
import { CursorPayload, decodeCursor } from '../../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../../database/prisma.service';
import { GetUserChatsQueryParamsDto } from '../../api/input-dto/get-user-chats.query-params.dto';
import { ChatListItemViewDto } from '../../api/view-dto/chat-list-item.view-dto';
import { ChatViewDto } from '../../api/view-dto/chat.view-dto';
import { UserChatsPageViewDto } from '../../api/view-dto/user-chats-page.view-dto';
import { ChatListRow } from '../types/chat-list-row.type';
import { ChatWithLastMessage } from '../types/chat-with-last-message.type';

@Injectable()
export class ChatsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findChatById(chatId: number, userId: number): Promise<ChatViewDto | null> {
    const chat: ChatWithLastMessage | null = await this.prisma.chat.findUnique({
      where: { id: chatId },
      include: { lastMessage: true },
    });

    if (!chat) {
      return null;
    }

    return ChatViewDto.mapToView(chat, userId);
  }

  async findUserChats(
    userId: number,
    params: GetUserChatsQueryParamsDto,
  ): Promise<UserChatsPageViewDto> {
    const cursorPayload: CursorPayload | null = params.cursor ? decodeCursor(params.cursor) : null;
    const take: number = getKeysetTake(params.limit);

    const cursorCondition = cursorPayload
      ? Prisma.sql`AND (COALESCE(c.last_message_at, c.created_at), c.id) < (${new Date(
          cursorPayload.createdAt,
        )}, ${Number(cursorPayload.id)})`
      : Prisma.empty;

    const rows: ChatListRow[] = await this.prisma.$queryRaw<ChatListRow[]>`
      SELECT
        c.id AS id,
        c.participant_a_id AS "participantAId",
        c.participant_b_id AS "participantBId",
        c.last_message_id AS "chatLastMessageId",
        c.last_message_at AS "chatLastMessageAt",
        c.created_at AS "chatCreatedAt",
        c.updated_at AS "chatUpdatedAt",
        m.id AS "messageId",
        m.chat_id AS "messageChatId",
        m.sender_id AS "messageSenderId",
        m.text AS "messageText",
        m.created_at AS "messageCreatedAt",
        m.client_message_id AS "messageClientMessageId",
        (
          SELECT COUNT(*)::int
          FROM messages um
          WHERE um.chat_id = c.id
            AND um.sender_id != ${userId}
            AND (
              crs.last_read_message_id IS NULL
              OR um.id > crs.last_read_message_id
            )
        ) AS "unreadCount"
      FROM chats c
      LEFT JOIN messages m ON m.id = c.last_message_id
      LEFT JOIN chat_read_states crs ON crs.chat_id = c.id AND crs.user_id = ${userId}
      WHERE (c.participant_a_id = ${userId} OR c.participant_b_id = ${userId})
        ${cursorCondition}
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
      LIMIT ${take}
    `;

    const paginated: CursorPaginatedResult<ChatListRow> = buildCursorPaginatedResult(
      rows,
      params.limit,
      (row) => ({
        createdAt: row.chatLastMessageAt ?? row.chatCreatedAt,
        id: String(row.id),
      }),
    );
    return {
      ...paginated,
      items: paginated.items.map((row) => ChatListItemViewDto.mapToView(row, userId)),
    };
  }
}
