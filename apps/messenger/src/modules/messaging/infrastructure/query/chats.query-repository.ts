import { Injectable } from '@nestjs/common';
import { Chat, Message, Prisma } from '@generated/prisma-messenger';
import {
  buildCursorPaginatedResult,
  CursorPaginatedResult,
  getKeysetTake,
} from '../../../../../../../libs/common/utils/cursor-pagination.util';
import { CursorPayload, decodeCursor } from '../../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../../database/prisma.service';
import { GetUserChatsQueryParamsDto } from '../../api/input-dto/get-user-chats.query-params.dto';
import { ChatListItemViewDto } from '../../api/view-dto/chat-list-item.view-dto';
import { UserChatsPageViewDto } from '../../api/view-dto/user-chats-page.view-dto';
import { ChatListRow } from '../types/chat-list-row.type';
import { UserChatListItem } from '../types/user-chat-list-item.type';

@Injectable()
export class ChatsQueryRepository {
  constructor(private readonly prisma: PrismaService) {}

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
        c.id,
        c.participant_a_id,
        c.participant_b_id,
        c.last_message_id,
        c.last_message_at,
        c.created_at,
        c.updated_at,
        m.id AS lm_id,
        m.chat_id AS lm_chat_id,
        m.sender_id AS lm_sender_id,
        m.text AS lm_text,
        m.created_at AS lm_created_at,
        (
          SELECT COUNT(*)::int
          FROM messages um
          WHERE um.chat_id = c.id
            AND um.sender_id != ${userId}
            AND (
              crs.last_read_message_id IS NULL
              OR um.id > crs.last_read_message_id
            )
        ) AS unread_count
      FROM chats c
      LEFT JOIN messages m ON m.id = c.last_message_id
      LEFT JOIN chat_read_states crs ON crs.chat_id = c.id AND crs.user_id = ${userId}
      WHERE (c.participant_a_id = ${userId} OR c.participant_b_id = ${userId})
        ${cursorCondition}
      ORDER BY COALESCE(c.last_message_at, c.created_at) DESC, c.id DESC
      LIMIT ${take}
    `;

    const items: UserChatListItem[] = rows.map((row) => this.mapRowToUserChatListItem(row, userId));

    const paginated: CursorPaginatedResult<UserChatListItem> = buildCursorPaginatedResult(
      items,
      params.limit,
      (item) => ({
        createdAt: item.chat.lastMessageAt ?? item.chat.createdAt,
        id: String(item.chat.id),
      }),
    );

    const page = new UserChatsPageViewDto();
    page.items = paginated.items.map((item) => ChatListItemViewDto.mapToView(item, userId));
    page.hasMore = paginated.hasMore;
    page.nextCursor = paginated.nextCursor;

    return page;
  }

  private mapRowToUserChatListItem(row: ChatListRow, userId: number): UserChatListItem {
    const chat: Chat = {
      id: row.id,
      participantAId: row.participant_a_id,
      participantBId: row.participant_b_id,
      lastMessageId: row.last_message_id,
      lastMessageAt: row.last_message_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };

    const lastMessage: Message | null = row.lm_id
      ? {
          id: row.lm_id,
          chatId: row.lm_chat_id!,
          senderId: row.lm_sender_id!,
          text: row.lm_text!,
          createdAt: row.lm_created_at!,
        }
      : null;

    const interlocutorId: number =
      chat.participantAId === userId ? chat.participantBId : chat.participantAId;

    return {
      chat,
      interlocutorId,
      lastMessage,
      unreadCount: row.unread_count,
    };
  }
}
