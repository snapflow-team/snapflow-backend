import { ApiProperty } from '@nestjs/swagger';
import { UserMetadataViewDto } from './user-metadata.view-dto';
import { ProfileWithUserMetadata } from '../../../infrastructure/types/profile-with-user-metadata.type';

export class PublicProfileViewDto {
  @ApiProperty({
    description: 'ID профиля пользователя',
    example: '15',
  })
  id: string;

  @ApiProperty({
    description: 'Уникальный username пользователя',
    example: 'username_01',
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
    type: String,
    description: 'Описание профиля пользователя',
    example: 'Backend developer',
    nullable: true,
  })
  aboutMe: string | null;

  @ApiProperty({
    type: UserMetadataViewDto,
  })
  userMetadata: UserMetadataViewDto;

  static mapToView(profile: ProfileWithUserMetadata): PublicProfileViewDto {
    const dto = new this();

    dto.id = profile.id.toString();
    dto.username = profile.username;
    dto.avatarUrl = profile.avatarUrl;
    dto.aboutMe = profile.aboutMe;
    dto.userMetadata = {
      followingCount: 0,
      followersCount: 0,
      publicationsCount: profile.user._count.posts,
    };

    return dto;
  }
}
