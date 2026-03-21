import { ApiProperty } from '@nestjs/swagger';

type PostMediaViewSource = {
  id: number;
  fileId: string;
  url: string;
};

export class PostMediaViewDto {
  @ApiProperty({
    example: 1,
    description: 'Идентификатор медиа',
  })
  id: number;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'File identifier',
  })
  fileId: string;

  @ApiProperty({
    example: 'https://cdn.example.com/users/10/file.jpg',
    description: 'Публичный URL медиа',
  })
  url: string;

  static mapToView(media: PostMediaViewSource): PostMediaViewDto {
    const dto = new PostMediaViewDto();
    dto.id = media.id;
    dto.fileId = media.fileId;
    dto.url = media.url;
    return dto;
  }
}
