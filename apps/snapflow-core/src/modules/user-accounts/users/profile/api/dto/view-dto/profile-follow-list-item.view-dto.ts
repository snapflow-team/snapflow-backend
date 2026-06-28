import { ApiProperty } from '@nestjs/swagger';

export class ProfileFollowListItemViewDto {
  @ApiProperty({
    type: String,
    description: 'ID пользователя',
    example: '1',
  })
  userId: string;

  @ApiProperty({
    description: 'Уникальный username пользователя',
    example: 'alice',
  })
  username: string;

  @ApiProperty({
    type: String,
    description: 'URL аватара пользователя',
    example: 'https://cdn.snapflow.cc/avatars/15.jpg',
    nullable: true,
  })
  avatarUrl: string | null;

  @ApiProperty({
    type: Number,
    description: 'ID профиля пользователя',
    example: 15,
  })
  profileId: number;

  @ApiProperty({
    description: 'Подписан ли текущий авторизованный зритель на пользователя',
    example: false,
  })
  isFollowing: boolean;
}
