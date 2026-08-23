import { ApiProperty } from '@nestjs/swagger';
import { ChatListRow } from '../../infrastructure/types/chat-list-row.type';
import { LastMessagePreviewViewDto } from './last-message-preview.view-dto';

type ChatListRowWithMessage = ChatListRow & {
  messageId: number;
  messageChatId: number;
  messageSenderId: number;
  messageText: string;
  messageCreatedAt: Date;
  messageClientMessageId: string;
  messageEditedAt: Date | null;
  messageDeletedAt: Date | null;
  messageDeletedForEveryone: boolean;
  messageReplyToMessageId: number | null;
  peerLastReadMessageId: number | null;
  messageDeliveredToPeer: boolean;
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
    type: LastMessagePreviewViewDto,
    nullable: true,
    description: 'Последнее сообщение в чате',
  })
  lastMessage: LastMessagePreviewViewDto | null;

  @ApiProperty({
    description: 'Количество непрочитанных сообщений',
    example: 3,
  })
  unreadCount: number;

  @ApiProperty({
    description: 'Заглушены ли push-уведомления по чату для текущего пользователя',
    example: false,
  })
  muted: boolean;

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
    dto.muted = row.muted;
    dto.createdAt = row.chatCreatedAt.toISOString();
    dto.updatedAt = row.chatUpdatedAt.toISOString();
    dto.lastMessage = isChatListRowWithMessage(row)
      ? LastMessagePreviewViewDto.mapToView(
          {
            id: row.messageId,
            senderId: row.messageSenderId,
            text: row.messageText,
            createdAt: row.messageCreatedAt,
            editedAt: row.messageEditedAt,
            deletedForEveryone: row.messageDeletedForEveryone ?? false,
          },
          {
            viewerId: userId,
            peerLastReadMessageId: row.peerLastReadMessageId,
            deliveredToPeer: row.messageDeliveredToPeer ?? false,
          },
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
