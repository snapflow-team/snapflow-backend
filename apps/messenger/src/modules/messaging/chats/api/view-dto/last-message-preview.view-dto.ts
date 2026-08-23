import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  MessageDeliveryStatus,
  MessageStatusContext,
  resolveMessageStatus,
} from '../../../messages/api/view-dto/message-status.resolver';

export type LastMessagePreviewSource = {
  id: number;
  senderId: number;
  text: string;
  createdAt: Date;
  editedAt?: Date | null;
  deletedForEveryone?: boolean;
};

export class LastMessagePreviewViewDto {
  @ApiProperty({
    type: String,
    description: 'Идентификатор сообщения',
    example: '1',
  })
  id: string;

  @ApiProperty({
    type: String,
    description: 'Идентификатор отправителя',
    example: '5',
  })
  senderId: string;

  @ApiProperty({
    description: 'Текст сообщения',
    example: 'Hello!',
  })
  text: string;

  @ApiProperty({
    description: 'Дата создания сообщения в формате ISO',
    example: '2026-07-05T18:00:00.000Z',
  })
  createdAt: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Дата последнего редактирования в формате ISO',
    example: '2026-07-05T18:05:00.000Z',
  })
  editedAt: string | null;

  @ApiProperty({
    description: 'Признак удаления сообщения для всех участников',
    example: false,
  })
  deletedForEveryone: boolean;

  @ApiPropertyOptional({
    enum: ['sent', 'delivered', 'read'],
    nullable: true,
    description:
      'Статус доставки/прочтения только для сообщений текущего пользователя как отправителя',
    example: 'sent',
  })
  status: MessageDeliveryStatus | null;

  static mapToView(
    message: LastMessagePreviewSource,
    context: MessageStatusContext = {},
  ): LastMessagePreviewViewDto {
    const deletedForEveryone = message.deletedForEveryone ?? false;
    const dto = new LastMessagePreviewViewDto();

    dto.id = message.id.toString();
    dto.senderId = message.senderId.toString();
    dto.text = deletedForEveryone ? '' : message.text;
    dto.createdAt = message.createdAt.toISOString();
    dto.editedAt = message.editedAt ? message.editedAt.toISOString() : null;
    dto.deletedForEveryone = deletedForEveryone;
    dto.status = resolveMessageStatus(message.id, message.senderId, context);

    return dto;
  }
}
