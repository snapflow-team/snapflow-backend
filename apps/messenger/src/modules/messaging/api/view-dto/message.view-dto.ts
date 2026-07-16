import { ApiProperty } from '@nestjs/swagger';
import { Message } from '@generated/prisma-messenger';

export class MessageViewDto {
  @ApiProperty({
    type: String,
    description: 'Идентификатор сообщения',
    example: '1',
  })
  id: string;

  @ApiProperty({
    type: String,
    description: 'Идентификатор чата',
    example: '10',
  })
  chatId: string;

  @ApiProperty({
    type: String,
    description: 'Идентификатор отправителя',
    example: '5',
  })
  senderId: string;

  @ApiProperty({
    type: String,
    description: 'Идентификатор получателя',
    example: '42',
  })
  receiverId: string;

  @ApiProperty({
    description: 'Текст сообщения',
    example: 'Hello!',
  })
  text: string;

  @ApiProperty({
    type: String,
    description: 'Идентификатор сообщения на клиенте (UUID) для идемпотентности',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  clientMessageId: string;

  @ApiProperty({
    description: 'Дата создания сообщения в формате ISO',
    example: '2026-07-05T18:00:00.000Z',
  })
  createdAt: string;

  static mapToView(message: Message, receiverId: number): MessageViewDto {
    const dto = new MessageViewDto();
    dto.id = message.id.toString();
    dto.chatId = message.chatId.toString();
    dto.senderId = message.senderId.toString();
    dto.receiverId = receiverId.toString();
    dto.text = message.text;
    dto.clientMessageId = message.clientMessageId;
    dto.createdAt = message.createdAt.toISOString();

    return dto;
  }
}
