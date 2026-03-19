import { ApiProperty } from '@nestjs/swagger';

type PostMediaViewSource = {
  id: number;
  url: string;
  mimeType: string;
  size: number;
  position: number;
};

export class PostMediaViewDto {
  @ApiProperty({
    example: 1,
    description: 'Идентификатор медиа',
  })
  id: number;

  @ApiProperty({
    example: 'https://cdn.example.com/users/10/file.jpg',
    description: 'Публичный URL медиа',
  })
  url: string;

  @ApiProperty({
    example: 'image/jpeg',
    description: 'MIME-тип медиа',
  })
  mimeType: string;

  @ApiProperty({
    example: 245001,
    description: 'Размер файла в байтах',
  })
  size: number;

  @ApiProperty({
    example: 0,
    description: 'Позиция медиа в посте',
  })
  position: number;

  static mapToView(media: PostMediaViewSource): PostMediaViewDto {
    const dto = new PostMediaViewDto();

    dto.id = media.id;
    dto.url = media.url;
    dto.mimeType = media.mimeType;
    dto.size = media.size;
    dto.position = media.position;

    return dto;
  }
}
