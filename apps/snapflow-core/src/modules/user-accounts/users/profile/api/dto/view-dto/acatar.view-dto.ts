import { ApiProperty } from '@nestjs/swagger';

export class AvatarViewDto {
  @ApiProperty({
    description: 'Публичный URL загруженного аватара пользователя',
    example: 'https://cdn.example.com/avatars/123.jpg',
  })
  publicUrl: string;
}
