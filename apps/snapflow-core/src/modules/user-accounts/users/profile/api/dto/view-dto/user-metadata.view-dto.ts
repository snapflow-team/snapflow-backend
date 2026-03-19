import { ApiProperty } from '@nestjs/swagger';

export class UserMetadataViewDto {
  @ApiProperty({
    type: Number,
    description: 'Количество подписок пользователя',
    example: 80,
    default: 0,
  })
  followingCount: number = 0;

  @ApiProperty({
    type: Number,
    description: 'Количество подписчиков',
    example: 120,
    default: 0,
  })
  followersCount: number = 0;

  @ApiProperty({
    type: Number,
    description: 'Количество опубликованных постов пользователя',
    example: 34,
    default: 0,
  })
  publicationsCount: number;
}
