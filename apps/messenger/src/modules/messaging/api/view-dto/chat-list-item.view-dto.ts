import { ApiProperty } from '@nestjs/swagger';
import { ChatListRow } from '../../infrastructure/types/chat-list-row.type';
import { MessageViewDto } from './message.view-dto';

type ChatListRowWithMessage = ChatListRow & {
  messageId: number;
  messageChatId: number;
  messageSenderId: number;
  messageText: string;
  messageCreatedAt: Date;
  messageClientMessageId: string;
};

export class ChatListItemViewDto {
  @ApiProperty({
    type: String,
    description: 'Идентификатор чата',
    example: '10',
  })
  id: string;

  @ApiProperty({
    type: String,
    description: 'Идентификатор собеседника',
    example: '42',
  })
  interlocutorId: string;

  @ApiProperty({
    type: MessageViewDto,
    nullable: true,
    description: 'Последнее сообщение в чате',
  })
  lastMessage: MessageViewDto | null;

  @ApiProperty({
    description: 'Количество непрочитанных сообщений',
    example: 3,
  })
  unreadCount: number;

  @ApiProperty({
    description: 'Дата создания чата в формате ISO',
    example: '2026-07-05T18:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Дата последнего обновления чата в формате ISO',
    example: '2026-07-06T12:00:00.000Z',
  })
  updatedAt: string;

  static mapToView(row: ChatListRow, userId: number): ChatListItemViewDto {
    const interlocutorId: number =
      row.participantAId === userId ? row.participantBId : row.participantAId;

    const dto = new ChatListItemViewDto();
    dto.id = row.id.toString();
    dto.interlocutorId = interlocutorId.toString();
    dto.unreadCount = row.unreadCount;
    dto.createdAt = row.chatCreatedAt.toISOString();
    dto.updatedAt = row.chatUpdatedAt.toISOString();
    dto.lastMessage = isChatListRowWithMessage(row)
      ? MessageViewDto.mapToView(
          {
            id: row.messageId,
            chatId: row.messageChatId,
            senderId: row.messageSenderId,
            text: row.messageText,
            clientMessageId: row.messageClientMessageId,
            createdAt: row.messageCreatedAt,
          },
          row.messageSenderId === userId ? interlocutorId : userId,
        )
      : null;

    return dto;
  }
}

function isChatListRowWithMessage(row: ChatListRow): row is ChatListRowWithMessage {
  return (
    row.messageId !== null &&
    row.messageChatId !== null &&
    row.messageSenderId !== null &&
    row.messageText !== null &&
    row.messageCreatedAt !== null &&
    row.messageClientMessageId !== null
  );
}
