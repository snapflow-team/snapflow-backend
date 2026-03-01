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

export type PostViewSource = {
  id: number;
  description: string | null;
  status: 'DRAFT' | 'PUBLISHED';
  createdAt: Date;
  user: { id: number; username: string };
  postMedias: Array<{
    id: number;
    url: string;
    mimeType: string;
    size: number;
    position: number;
  }>;
};
export class PostViewDto {
  @ApiProperty({
    example: 101,
    description: 'Идентификатор поста',
  })
  id: number;

  @ApiProperty({
    example: 'Мой новый пост',
    nullable: true,
    description: 'Описание поста',
  })
  description: string | null;

  @ApiProperty({
    example: '12',
    description: 'Id юзера',
  })
  ownerId: number;

  @ApiProperty({
    example: 'john_doe',
    description: 'Имя пользователя (username)',
  })
  name: string;

  @ApiProperty({
    example: 'PUBLISHED',
    enum: ['DRAFT', 'PUBLISHED'],
    description: 'Статус поста',
  })
  status: 'DRAFT' | 'PUBLISHED';

  @ApiProperty({
    example: '2026-02-15T18:59:28.562Z',
    description: 'Дата создания поста в ISO-формате',
  })
  createdAt: string;

  @ApiProperty({
    type: [PostMediaViewDto],
    description: 'Список медиа поста',
  })
  postMedias: PostMediaViewDto[];

  static mapToView(post: PostViewSource): PostViewDto {
    const dto = new PostViewDto();

    dto.id = post.id;
    dto.description = post.description;
    dto.ownerId = post.user.id;
    dto.name = post.user.username;
    dto.status = post.status;
    dto.createdAt = post.createdAt.toISOString();
    dto.postMedias = post.postMedias.map((m) => PostMediaViewDto.mapToView(m));

    return dto;
  }
}
