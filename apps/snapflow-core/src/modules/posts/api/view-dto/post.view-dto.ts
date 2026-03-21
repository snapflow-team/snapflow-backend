import { ApiProperty } from '@nestjs/swagger';
import { PostMediaViewDto } from './post-media.view-dto';
import { PostWithInclude } from '../../types/post-with-media.type';
import { OwnerViewDto } from './owner.view-dto';

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
    description: 'Author profile id',
  })
  profileId: number;

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
    example: '2026-02-15T18:59:28.562Z',
    description: 'Post update date in ISO format',
  })
  updateAt: string;

  @ApiProperty({
    type: [PostMediaViewDto],
    description: 'Post media list',
  })
  postMedias: PostMediaViewDto[];

  @ApiProperty({ type: OwnerViewDto })
  owner: OwnerViewDto;

  static mapToView(post: PostWithInclude): PostViewDto {
    const dto = new PostViewDto();

    dto.id = post.id;
    dto.description = post.description;
    dto.profileId = post.user.profiles[0].id;
    dto.username = post.user.username;
    dto.status = post.status;
    dto.createdAt = post.createdAt.toISOString();
    dto.updateAt = post.updatedAt.toISOString();
    dto.postMedias = post.postMedias.map((m) => PostMediaViewDto.mapToView(m));
    dto.owner = OwnerViewDto.mapToView(post.user.profiles[0]);
    return dto;
  }
}
