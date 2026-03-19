import { ApiProperty } from '@nestjs/swagger';
import { PostMediaViewDto } from './post-media.view-dto';
import { PostWithInclude } from '../../../../../../../libs/prisma/post.include';

export class PostViewDto {
  @ApiProperty({
    example: 101,
    description: 'Post identifier',
  })
  id: number;

  @ApiProperty({
    example: 'My new post',
    nullable: true,
    description: 'Post description',
  })
  description: string | null;

  @ApiProperty({
    example: '12',
    nullable: true,
    description: 'Author profile id',
  })
  profileId: number | null;

  @ApiProperty({
    example: 'john_doe',
    description: 'Username',
  })
  username: string;

  @ApiProperty({
    example: 'PUBLISHED',
    enum: ['DRAFT', 'PUBLISHED'],
    description: 'Post status',
  })
  status: 'DRAFT' | 'PUBLISHED';

  @ApiProperty({
    example: '2026-02-15T18:59:28.562Z',
    description: 'Post creation date in ISO format',
  })
  createdAt: string;

  @ApiProperty({
    type: [PostMediaViewDto],
    description: 'Post media list',
  })
  postMedias: PostMediaViewDto[];

  static mapToView(post: PostWithInclude): PostViewDto {
    const dto = new PostViewDto();

    dto.id = post.id;
    dto.description = post.description;
    dto.profileId = post.user.profiles[0]?.id ?? null;
    dto.username = post.user.username;
    dto.status = post.status;
    dto.createdAt = post.createdAt.toISOString();
    dto.postMedias = post.postMedias.map((m) => PostMediaViewDto.mapToView(m));

    return dto;
  }
}
