import { Injectable } from '@nestjs/common';
import { Message } from '@generated/prisma-messenger';
import {
  buildCursorPaginatedResult,
  buildKeysetCursorFilter,
  CursorPaginatedResult,
  getKeysetTake,
  KEYSET_ORDER_BY_CREATED_AT_DESC,
} from '../../../../../../libs/common/utils/cursor-pagination.util';
import { CursorPayload, decodeCursor } from '../../../../../../libs/common/utils/cursor.util';
import { PrismaService } from '../../database/prisma.service';
import { FindChatMessagesPaginatedParams } from './types/user-chat-list-item.type';

export class CreateMessageRepositoryDto {
  chatId: number;
  senderId: number;
  text: string;
}

@Injectable()
export class MessagesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateMessageRepositoryDto): Promise<Message> {
    return this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          chatId: dto.chatId,
          senderId: dto.senderId,
          text: dto.text,
        },
      });

      await tx.chat.update({
        where: { id: dto.chatId },
        data: {
          lastMessageId: message.id,
          lastMessageAt: message.createdAt,
        },
      });

      return message;
    });
  }

  async findById(id: number): Promise<Message | null> {
    return this.prisma.message.findUnique({
      where: { id },
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
