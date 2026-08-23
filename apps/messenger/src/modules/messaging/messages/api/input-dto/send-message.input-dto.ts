import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { IsStringWithTrim } from '../../../../../../../../libs/common/decorators/validation/is-string-with-trim.decorator';

export const messageTextConstraints = {
  minLength: 1,
  maxLength: 1000,
};

const positiveIntegerStringPattern = /^[1-9]\d*$/;

export class SendMessageInputDto {
  @IsString()
  @Matches(positiveIntegerStringPattern, {
    message: 'receiverId must be a positive integer string',
  })
  @ApiProperty({
    type: String,
    description: 'Идентификатор получателя сообщения',
    example: '42',
  })
  receiverId: string;

  @IsStringWithTrim(messageTextConstraints.minLength, messageTextConstraints.maxLength)
  @ApiProperty({
    description: 'Текст сообщения от 1 до 1000 символов',
    minLength: messageTextConstraints.minLength,
    maxLength: messageTextConstraints.maxLength,
    example: 'Hello!',
  })
  text: string;

  @IsUUID()
  @ApiProperty({
    type: String,
    description: 'Идентификатор сообщения на клиенте (UUID) для идемпотентности',
    example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
  })
  clientMessageId: string;

  @IsOptional()
  @IsString()
  @Matches(positiveIntegerStringPattern, {
    message: 'replyToMessageId must be a positive integer string',
  })
  @ApiPropertyOptional({
    type: String,
    description: 'Идентификатор сообщения, на которое дан ответ',
    example: '15',
  })
  replyToMessageId?: string;
}
