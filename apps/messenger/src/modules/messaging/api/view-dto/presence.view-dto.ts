import { ApiProperty } from '@nestjs/swagger';

export class PresenceViewDto {
  @ApiProperty({
    type: String,
    description: 'Идентификатор пользователя',
    example: '42',
  })
  userId: string;

  @ApiProperty({
    type: Boolean,
    description: 'Онлайн-статус (false, если статус скрыт правилами приватности)',
    example: true,
  })
  online: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Время последней активности в ISO; null если онлайн или статус скрыт',
    example: '2026-07-22T18:00:00.000Z',
  })
  lastSeenAt: string | null;
}
