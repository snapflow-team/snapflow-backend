import { ApiProperty } from '@nestjs/swagger';
import { PostMediaViewDto } from './post-media.view-dto';
import { PostWithInclude } from '../../types/post-with-media.type';
import { OwnerViewDto } from './owner.view-dto';
import { PostStatus } from '@generated/prisma-snapflow';

export class PostViewDto {
  @ApiProperty({
    type: String,
    example: 101,
    description: 'Post identifier',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'My new post',
    nullable: true,
    description: 'Post description',
  })
  description: string | null;

  @ApiProperty({
    type: PostStatus,
    enumName: 'PostStatus',
    example: 'PUBLISHED',
    enum: PostStatus,
    description: 'Post status',
  })
  status: PostStatus;

  @ApiProperty({
    type: String,
    example: '2026-02-15T18:59:28.562Z',
    description: 'Post creation date in ISO format',
  })
  createdAt: string;

  @ApiProperty({
    type: [PostMediaViewDto],
    description: 'Post media list',
  })
  postMedias: PostMediaViewDto[];

  @ApiProperty({ type: OwnerViewDto })
  owner: OwnerViewDto;

  static mapToView(post: PostWithInclude): PostViewDto {
    const dto = new PostViewDto();

    dto.id = post.id.toString();
    dto.description = post.description;
    dto.status = post.status;
    dto.createdAt = post.createdAt.toISOString();
    dto.postMedias = post.postMedias.map((m) => PostMediaViewDto.mapToView(m));
    dto.owner = OwnerViewDto.mapToView({
      ownerId: post.user.id,
      username: post.user.username,
      avatarUrl: post.user.profiles[0]?.avatarUrl ?? null,
    });
    return dto;
  }
}
