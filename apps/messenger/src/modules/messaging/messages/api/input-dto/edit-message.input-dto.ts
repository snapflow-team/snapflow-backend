import { ApiProperty } from '@nestjs/swagger';
import { IsStringWithTrim } from '../../../../../../../../libs/common/decorators/validation/is-string-with-trim.decorator';
import { messageTextConstraints } from './send-message.input-dto';

export class EditMessageInputDto {
  @IsStringWithTrim(messageTextConstraints.minLength, messageTextConstraints.maxLength)
  @ApiProperty({
    description: 'Текст сообщения от 1 до 1000 символов',
    minLength: messageTextConstraints.minLength,
    maxLength: messageTextConstraints.maxLength,
    example: 'Updated text',
  })
  text: string;
}
