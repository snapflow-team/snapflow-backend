import { ApiProperty } from '@nestjs/swagger';

type UserSearchResultViewSource = {
  id: number;
  username: string;
  profiles: { id: number; avatarUrl: string | null }[];
};

export class UserSearchResultViewDto {
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
    nullable: true,
  })
  profileId: number | null;

  static mapToView(user: UserSearchResultViewSource): UserSearchResultViewDto {
    const dto = new this();

    dto.userId = user.id.toString();
    dto.username = user.username;
    dto.avatarUrl = user.profiles[0]?.avatarUrl ?? null;
    dto.profileId = user.profiles[0]?.id ?? null;

    return dto;
  }
}
