import { Injectable } from '@nestjs/common';
import { Message, MessageDelivery, Prisma } from '@generated/prisma-messenger';
import {
  buildCursorPaginatedResult,
  buildKeysetCursorFilter,
  CursorPaginatedResult,
  getKeysetTake,
  KEYSET_ORDER_BY_CREATED_AT_DESC,
} from '../../../../../../libs/common/utils/cursor-pagination.util';
import { CursorPayload, decodeCursor } from '../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../database/prisma.service';
import { CreateMessageRepositoryDto } from './dto/create-message.repository-dto';
import { CreateMessageResult, CreateMessageRow } from './types/create-message-result.type';
import { FindChatMessagesPaginatedParams } from './types/user-chat-list-item.type';

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createOrGetExisting(
    dto: CreateMessageRepositoryDto,
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<CreateMessageResult> {
    const rows: CreateMessageRow[] = await tx.$queryRaw<CreateMessageRow[]>`
      WITH inserted AS (
        INSERT INTO messages (chat_id, sender_id, text, client_message_id)
        VALUES (${dto.chatId}, ${dto.senderId}, ${dto.text}, ${dto.clientMessageId}::uuid)
        ON CONFLICT (chat_id, sender_id, client_message_id) DO NOTHING
        RETURNING
          id,
          chat_id AS "chatId",
          sender_id AS "senderId",
          text,
          client_message_id AS "clientMessageId",
          created_at AS "createdAt",
          edited_at AS "editedAt",
          deleted_at AS "deletedAt",
          deleted_for_everyone AS "deletedForEveryone",
          reply_to_message_id AS "replyToMessageId",
          true AS "isNew"
      )
      SELECT * FROM inserted
      UNION ALL
      SELECT
        m.id,
        m.chat_id AS "chatId",
        m.sender_id AS "senderId",
        m.text,
        m.client_message_id AS "clientMessageId",
        m.created_at AS "createdAt",
        m.edited_at AS "editedAt",
        m.deleted_at AS "deletedAt",
        m.deleted_for_everyone AS "deletedForEveryone",
        m.reply_to_message_id AS "replyToMessageId",
        false AS "isNew"
      FROM messages m
      WHERE m.chat_id = ${dto.chatId}
        AND m.sender_id = ${dto.senderId}
        AND m.client_message_id = ${dto.clientMessageId}::uuid
        AND NOT EXISTS (SELECT 1 FROM inserted)
      LIMIT 1
    `;

    const row: CreateMessageRow = rows[0];
    const { isNew, ...message } = row;

    return { message, isNew };
  }

  async findById(id: number): Promise<Message | null> {
    return this.prisma.message.findUnique({
      where: { id },
    });
  }

  async upsertDelivery(messageId: number, userId: number): Promise<MessageDelivery> {
    return this.prisma.messageDelivery.upsert({
      where: {
        messageId_userId: {
          messageId,
          userId,
        },
      },
      create: {
        messageId,
        userId,
      },
      update: {},
    });
  }

  async findByChatIdPaginated(
    chatId: number,
    params: FindChatMessagesPaginatedParams,
  ): Promise<CursorPaginatedResult<Message>> {
    const cursorPayload: CursorPayload | null = params.cursor ? decodeCursor(params.cursor) : null;

    const rows = await this.prisma.message.findMany({
      where: {
        chatId,
        ...(params.viewerUserId !== undefined
          ? {
              NOT: {
                userDeletions: {
                  some: { userId: params.viewerUserId },
                },
              },
            }
          : {}),
        ...(cursorPayload ? buildKeysetCursorFilter(cursorPayload, { parseId: Number }) : {}),
      },
      orderBy: [...KEYSET_ORDER_BY_CREATED_AT_DESC],
      take: getKeysetTake(params.limit),
    });

    return buildCursorPaginatedResult(rows, params.limit, (message) => ({
      createdAt: message.createdAt,
      id: String(message.id),
    }));
  }
}
