import { ApiProperty } from '@nestjs/swagger';
import { ChatWithLastMessage } from '../../infrastructure/types/chat-with-last-message.type';
import { LastMessagePreviewViewDto } from './last-message-preview.view-dto';

export class ChatViewDto {
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
    description: 'Дата создания чата в формате ISO',
    example: '2026-07-05T18:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    description: 'Дата последнего обновления чата в формате ISO',
    example: '2026-07-06T12:00:00.000Z',
  })
  updatedAt: string;

  static mapToView(chat: ChatWithLastMessage, userId: number): ChatViewDto {
    const interlocutorId: number =
      chat.participantAId === userId ? chat.participantBId : chat.participantAId;

    const dto = new ChatViewDto();
    dto.id = chat.id.toString();
    dto.interlocutorId = interlocutorId.toString();
    dto.createdAt = chat.createdAt.toISOString();
    dto.updatedAt = chat.updatedAt.toISOString();
    dto.lastMessage = chat.lastMessage
      ? LastMessagePreviewViewDto.mapToView(chat.lastMessage, { viewerId: userId })
      : null;

    return dto;
  }
}
