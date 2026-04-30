import { ApiProperty } from '@nestjs/swagger';

type OwnerViewSource = {
  userId: number;
  profileId: number;
  username: string;
  avatarUrl: string | null;
};
export class OwnerViewDto {
  @ApiProperty({
    type: String,
    example: '1',
    description: 'Идентификатор пользователя',
  })
  userId: string;

  @ApiProperty({
    type: String,
    example: '42',
    description: 'Идентификатор профиля пользователя',
  })
  profileId: string;

  @ApiProperty({ example: 'John', description: 'Имя юзера' })
  username: string;

  @ApiProperty({
    type: String,
    example: 'https://cdn.example.com/users/10/file.jpg',
    nullable: true,
    description: 'Публичный URL',
  })
  avatarUrl: string | null;

  static mapToView(owner: OwnerViewSource): OwnerViewDto {
    const dto = new OwnerViewDto();
    dto.userId = owner.userId.toString();
    dto.profileId = owner.profileId.toString();
    dto.username = owner.username;
    dto.avatarUrl = owner.avatarUrl;
    return dto;
  }
}
