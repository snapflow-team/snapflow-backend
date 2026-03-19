import { ApiProperty } from '@nestjs/swagger';
import { UserProfile } from '@generated/prisma-snapflow';

export class ProfileViewDto {
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
    description: 'Имя пользователя',
    example: 'Alex',
    nullable: true,
  })
  firstName: string | null;

  @ApiProperty({
    type: String,
    description: 'Фамилия пользователя',
    example: 'Smith',
    nullable: true,
  })
  lastName: string | null;

  @ApiProperty({
    type: String,
    description: 'Дата рождения в формате YYYY-MM-DD',
    example: '2000-01-01',
    nullable: true,
  })
  dateOfBirth: string | null;

  @ApiProperty({
    type: String,
    description: 'Страна пользователя',
    example: 'Russia',
    nullable: true,
  })
  country: string | null;

  @ApiProperty({
    type: String,
    description: 'Город пользователя',
    example: 'Moscow',
    nullable: true,
  })
  city: string | null;

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

  // todo: перенести это поле в public-dto
  // @ApiProperty({
  //   type: Number,
  //   description: 'Количество подписчиков',
  //   example: 120,
  //   default: 0,
  // })
  // followersCount: number = 0;

  // todo: перенести это поле в public-dto
  // @ApiProperty({
  //   type: Number,
  //   description: 'Количество подписок пользователя',
  //   example: 80,
  //   default: 0,
  // })
  // followingCount: number = 0;

  // todo: перенести это поле в public-dto
  // @ApiProperty({
  //   type: Number,
  //   description: 'Количество постов пользователя',
  //   example: 34,
  //   default: 0,
  // })
  // postsCount: number = 0;

  static mapToView(profile: UserProfile): ProfileViewDto {
    const dto = new this();

    dto.id = profile.id.toString();
    dto.username = profile.username;
    dto.firstName = profile.firstName;
    dto.lastName = profile.lastName;
    dto.dateOfBirth = profile.dateOfBirth ? profile.dateOfBirth.toISOString().split('T')[0] : null;
    dto.country = profile.country;
    dto.city = profile.city;
    dto.avatarUrl = profile.avatarUrl;
    dto.aboutMe = profile.aboutMe;

    return dto;
  }
}
