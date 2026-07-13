import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

const positiveIntegerStringPattern = /^[1-9]\d*$/;

export class GetOrCreateChatInputDto {
  @IsString()
  @Matches(positiveIntegerStringPattern, {
    message: 'interlocutorId must be a positive integer string',
  })
  @ApiProperty({
    type: String,
    description: 'Идентификатор собеседника',
    example: '42',
  })
  interlocutorId: string;
}
