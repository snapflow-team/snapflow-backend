import { ApiProperty } from '@nestjs/swagger';

export type ReplyPreviewSource = {
  id: number;
  senderId: number;
  text: string;
  deletedForEveryone: boolean;
};

export class ReplyPreviewViewDto {
  @ApiProperty({
    type: String,
    description: 'Идентификатор исходного сообщения',
    example: '1',
  })
  id: string;

  @ApiProperty({
    type: String,
    description: 'Идентификатор отправителя исходного сообщения',
    example: '5',
  })
  senderId: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Текст исходного сообщения; null, если удалено для всех',
    example: 'Original text',
  })
  text: string | null;

  @ApiProperty({
    description: 'Признак удаления исходного сообщения для всех',
    example: false,
  })
  deletedForEveryone: boolean;

  static mapToView(message: ReplyPreviewSource): ReplyPreviewViewDto {
    const dto = new ReplyPreviewViewDto();
    dto.id = message.id.toString();
    dto.senderId = message.senderId.toString();
    dto.deletedForEveryone = message.deletedForEveryone;
    dto.text = message.deletedForEveryone ? null : message.text;

    return dto;
  }
}
