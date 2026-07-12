import { Injectable } from '@nestjs/common';
import { Chat, Message, Prisma } from '@generated/prisma-messenger';
import {
  buildCursorPaginatedResult,
  CursorPaginatedResult,
  getKeysetTake,
} from '../../../../../../libs/common/utils/cursor-pagination.util';
import { CursorPayload, decodeCursor } from '../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../database/prisma.service';
import { ChatListRow } from './types/chat-list-row.type';
import { FindUserChatsPaginatedParams, UserChatListItem } from './types/user-chat-list-item.type';

@Injectable()
export class ChatsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async getOrCreate(participantIdA: number, participantIdB: number): Promise<Chat> {
    const { participantAId, participantBId } = this.normalizeParticipants(
      participantIdA,
      participantIdB,
    );

    return this.prisma.chat.upsert({
      where: {
        participantAId_participantBId: {
          participantAId,
          participantBId,
        },
      },
      create: {
        participantAId,
        participantBId,
      },
      update: {},
    });
  }

  async findById(chatId: number): Promise<Chat | null> {
    return this.prisma.chat.findUnique({
      where: { id: chatId },
    });
  }

  async findUserChatsPaginated(
    userId: number,
    params: FindUserChatsPaginatedParams,
  ): Promise<CursorPaginatedResult<UserChatListItem>> {
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

    return buildCursorPaginatedResult(items, params.limit, (item) => ({
      createdAt: item.chat.lastMessageAt ?? item.chat.createdAt,
      id: String(item.chat.id),
    }));
  }

  async isParticipant(chatId: number, userId: number): Promise<boolean> {
    const chat = await this.prisma.chat.findUnique({
      where: { id: chatId },
      select: { participantAId: true, participantBId: true },
    });

    if (!chat) {
      return false;
    }

    return chat.participantAId === userId || chat.participantBId === userId;
  }

  getInterlocutorId(chat: Pick<Chat, 'participantAId' | 'participantBId'>, userId: number): number {
    return chat.participantAId === userId ? chat.participantBId : chat.participantAId;
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

    return {
      chat,
      interlocutorId: this.getInterlocutorId(chat, userId),
      lastMessage,
      unreadCount: row.unread_count,
    };
  }

  private normalizeParticipants(
    participantIdA: number,
    participantIdB: number,
  ): { participantAId: number; participantBId: number } {
    return participantIdA < participantIdB
      ? { participantAId: participantIdA, participantBId: participantIdB }
      : { participantAId: participantIdB, participantBId: participantIdA };
  }
}
