import { ApiProperty } from '@nestjs/swagger';

export class UnreadCountViewDto {
  @ApiProperty({
    type: Number,
    description: 'Суммарное число непрочитанных сообщений по всем чатам пользователя',
    example: 5,
  })
  total: number;
}
