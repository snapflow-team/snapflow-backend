import { ApiProperty } from '@nestjs/swagger';

export type ProfileFollowListItemViewSource = {
  userId: number;
  username: string;
  avatarUrl: string | null;
  profileId: number;
};

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

  static mapToView(
    source: ProfileFollowListItemViewSource,
    isFollowing: boolean,
  ): ProfileFollowListItemViewDto {
    const dto = new this();

    dto.userId = source.userId.toString();
    dto.username = source.username;
    dto.avatarUrl = source.avatarUrl;
    dto.profileId = source.profileId;
    dto.isFollowing = isFollowing;

    return dto;
  }
}
