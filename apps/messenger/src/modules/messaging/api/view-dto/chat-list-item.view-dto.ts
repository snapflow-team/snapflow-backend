import { ApiProperty } from '@nestjs/swagger';
import { UserChatListItem } from '../../infrastructure/types/user-chat-list-item.type';
import { MessageViewDto } from './message.view-dto';

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

  static mapToView(item: UserChatListItem, userId: number): ChatListItemViewDto {
    const dto = new ChatListItemViewDto();
    dto.id = item.chat.id.toString();
    dto.interlocutorId = item.interlocutorId.toString();
    dto.unreadCount = item.unreadCount;
    dto.createdAt = item.chat.createdAt.toISOString();
    dto.updatedAt = item.chat.updatedAt.toISOString();
    dto.lastMessage = item.lastMessage
      ? MessageViewDto.mapToView(
          item.lastMessage,
          item.lastMessage.senderId === userId ? item.interlocutorId : userId,
        )
      : null;

    return dto;
  }
}
