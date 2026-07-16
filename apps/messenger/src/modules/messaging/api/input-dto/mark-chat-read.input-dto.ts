import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

const positiveIntegerStringPattern = /^[1-9]\d*$/;

export class MarkChatReadInputDto {
  @IsString()
  @Matches(positiveIntegerStringPattern, {
    message: 'lastReadMessageId must be a positive integer string',
  })
  @ApiProperty({
    type: String,
    description: 'Идентификатор последнего прочитанного сообщения',
    example: '42',
  })
  lastReadMessageId: string;
}
