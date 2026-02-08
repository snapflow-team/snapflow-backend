import { RawUserForMe } from '../../../users/infrastructure/raw-user-for-me';
import { ApiProperty } from '@nestjs/swagger';

export class MeViewDto {
  @ApiProperty({ example: '1', description: 'ID пользователя' })
  userId: string;

  @ApiProperty({ example: 'ivan@example.dev', description: 'Email пользователя' })
  email: string;

  @ApiProperty({ example: 'ivan', description: 'Имя пользователя' })
  username: string;

  static mapToView(user: RawUserForMe): MeViewDto {
    const dto = new this();

    dto.userId = user.id.toString();
    dto.email = user.email;
    dto.username = user.username;

    return dto;
  }
}
