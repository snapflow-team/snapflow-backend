import { ApiProperty } from '@nestjs/swagger';
import { PostMediaViewDto } from './post-media.view-dto';
import { PostWithMediaAndUserMetadata } from '../../infrastructure/types/post-with-media-and-user-metadata.type';
import { OwnerViewDto } from './owner.view-dto';
import { RecentLikerViewDto } from './recent-liker.view-dto';
import { PostStatus } from '@generated/prisma-snapflow';

export class PostViewDto {
  @ApiProperty({
    type: String,
    example: 101,
    description: 'Идентификатор публикации',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'My new post',
    nullable: true,
    description: 'Описание публикации',
  })
  description: string | null;

  @ApiProperty({
    type: PostStatus,
    enumName: 'PostStatus',
    example: 'PUBLISHED',
    enum: PostStatus,
    description: 'Статус публикации',
  })
  status: PostStatus;

  @ApiProperty({
    type: String,
    example: '2026-02-15T18:59:28.562Z',
    description: 'Дата создания публикации в формате ISO',
  })
  createdAt: string;

  @ApiProperty({
    type: [PostMediaViewDto],
    description: 'Список медиа публикации',
  })
  postMedias: PostMediaViewDto[];

  @ApiProperty({ type: OwnerViewDto })
  owner: OwnerViewDto;

  @ApiProperty({
    type: Number,
    example: 12,
    description: 'Общее количество лайков',
  })
  likesCount: number;

  @ApiProperty({
    type: Number,
    example: 5,
    description: 'Общее количество комментариев (включая ответы)',
  })
  commentsCount: number;

  @ApiProperty({
    type: Boolean,
    example: false,
    description: 'Поставил ли текущий пользователь лайк',
  })
  isLikedByCurrentUser: boolean;

  @ApiProperty({
    type: [RecentLikerViewDto],
    description: 'До 3 последних поставивших лайк (сначала самые новые)',
  })
  recentLikers: RecentLikerViewDto[];

  static mapToView(post: PostWithMediaAndUserMetadata, isLikedByCurrentUser = false): PostViewDto {
    const dto = new PostViewDto();

    dto.id = post.id.toString();
    dto.description = post.description;
    dto.status = post.status;
    dto.createdAt = post.createdAt.toISOString();
    dto.postMedias = post.postMedias.map((m) => PostMediaViewDto.mapToView(m));
    dto.owner = OwnerViewDto.mapToView({
      userId: post.user.id,
      profileId: post.user.profiles[0].id,
      username: post.user.username,
      avatarUrl: post.user.profiles[0]?.avatarUrl ?? null,
    });
    dto.likesCount = post._count.likes;
    dto.commentsCount = post._count.comments;
    dto.isLikedByCurrentUser = isLikedByCurrentUser;
    dto.recentLikers = post.likes.map((like) =>
      RecentLikerViewDto.mapToView({
        userId: like.user.id,
        avatarUrl: like.user.profiles[0]?.avatarUrl ?? null,
      }),
    );

    return dto;
  }
}
