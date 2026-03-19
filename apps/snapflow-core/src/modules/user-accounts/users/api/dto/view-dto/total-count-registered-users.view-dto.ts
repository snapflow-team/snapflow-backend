import { ApiProperty } from '@nestjs/swagger';

export class TotalCountRegisteredUsersViewDto {
  @ApiProperty({
    description: 'Общее количество зарегистрированных пользователей',
    example: 1523,
  })
  totalCount: number;
}
