import { ApiProperty } from '@nestjs/swagger';
import { Chat, Message } from '@generated/prisma-messenger';
import { MessageViewDto } from './message.view-dto';

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
    type: MessageViewDto,
    nullable: true,
    description: 'Последнее сообщение в чате',
  })
  lastMessage: MessageViewDto | null;

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

  static mapToView(
    chat: Chat,
    interlocutorId: number,
    userId: number,
    lastMessage: Message | null,
  ): ChatViewDto {
    const dto = new ChatViewDto();
    dto.id = chat.id.toString();
    dto.interlocutorId = interlocutorId.toString();
    dto.createdAt = chat.createdAt.toISOString();
    dto.updatedAt = chat.updatedAt.toISOString();
    dto.lastMessage = lastMessage
      ? MessageViewDto.mapToView(
          lastMessage,
          lastMessage.senderId === userId ? interlocutorId : userId,
        )
      : null;

    return dto;
  }
}
