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
import { MessageViewDto } from '../../api/view-dto/message.view-dto';

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

    return {
      ...paginated,
      items: paginated.items.map((message) =>
        MessageViewDto.mapToView(message, message.senderId === userId ? interlocutorId : userId),
      ),
    };
  }
}
