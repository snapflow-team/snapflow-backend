import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ReplyPreviewSource, ReplyPreviewViewDto } from './reply-preview.view-dto';

// TODO(refactor-message-view-dto): вынести mapToView, resolveMessageStatus и tombstone-маскировку
// в отдельный mapper (например message-view.mapper.ts); оставить здесь только Swagger-поля DTO.

export type MessageDeliveryStatus = 'sent' | 'delivered' | 'read';

export type MessageViewSource = {
  id: number;
  chatId: number;
  senderId: number;
  text: string;
  clientMessageId: string;
  createdAt: Date;
  editedAt?: Date | null;
  deletedAt?: Date | null;
  deletedForEveryone?: boolean;
  replyToMessageId?: number | null;
};

export type MessageViewMapContext = {
  viewerId?: number;
  peerLastReadMessageId?: number | null;
  deliveredToPeer?: boolean;
  replyTo?: ReplyPreviewSource | null;
};

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

  @ApiPropertyOptional({
    enum: ['sent', 'delivered', 'read'],
    nullable: true,
    description:
      'Статус доставки/прочтения только для сообщений текущего пользователя как отправителя',
    example: 'sent',
  })
  status: MessageDeliveryStatus | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Дата последнего редактирования в формате ISO',
    example: '2026-07-05T18:05:00.000Z',
  })
  editedAt: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Дата удаления для всех в формате ISO',
    example: '2026-07-05T18:10:00.000Z',
  })
  deletedAt: string | null;

  @ApiProperty({
    description: 'Признак удаления сообщения для всех участников',
    example: false,
  })
  deletedForEveryone: boolean;

  @ApiProperty({
    type: ReplyPreviewViewDto,
    nullable: true,
    description: 'Превью сообщения, на которое дан ответ',
  })
  replyTo: ReplyPreviewViewDto | null;

  static mapToView(
    message: MessageViewSource,
    receiverId: number,
    context: MessageViewMapContext = {},
  ): MessageViewDto {
    const deletedForEveryone = message.deletedForEveryone ?? false;
    const dto = new MessageViewDto();

    dto.id = message.id.toString();
    dto.chatId = message.chatId.toString();
    dto.senderId = message.senderId.toString();
    dto.receiverId = receiverId.toString();
    dto.text = deletedForEveryone ? '' : message.text;
    dto.clientMessageId = message.clientMessageId;
    dto.createdAt = message.createdAt.toISOString();
    dto.status = resolveMessageStatus(message.id, message.senderId, context);
    dto.editedAt = message.editedAt ? message.editedAt.toISOString() : null;
    dto.deletedAt = message.deletedAt ? message.deletedAt.toISOString() : null;
    dto.deletedForEveryone = deletedForEveryone;
    dto.replyTo = context.replyTo ? ReplyPreviewViewDto.mapToView(context.replyTo) : null;

    return dto;
  }
}

function resolveMessageStatus(
  messageId: number,
  senderId: number,
  context: MessageViewMapContext,
): MessageDeliveryStatus | null {
  if (context.viewerId === undefined || context.viewerId !== senderId) {
    return null;
  }

  if (context.peerLastReadMessageId != null && context.peerLastReadMessageId >= messageId) {
    return 'read';
  }

  if (context.deliveredToPeer) {
    return 'delivered';
  }

  return 'sent';
}
