import { ApiProperty } from '@nestjs/swagger';

export class UnreadNotificationsCountViewDto {
  @ApiProperty({
    description: 'Количество не прочитанных уведомлений у пользователя',
    example: '3',
    type: String,
  })
  count: string;

  static mapToView(count: number): UnreadNotificationsCountViewDto {
    const dto = new UnreadNotificationsCountViewDto();
    dto.count = count.toString();

    return dto;
  }
}
