import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommentAuthorViewDto } from './comment-author.view-dto';
import { CommentWithUserMetadata } from '../../infrastructure/types/comment-with-user-metadata.type';

export class CommentItemViewDto {
  @ApiProperty({
    type: String,
    example: '42',
    description: 'Идентификатор комментария',
  })
  id: string;

  @ApiProperty({
    type: String,
    example: 'Great post!',
    description: 'Текст комментария',
  })
  text: string;

  @ApiProperty({
    type: String,
    example: '2026-02-15T18:59:28.562Z',
    description: 'Дата создания комментария в формате ISO',
  })
  createdAt: string;

  @ApiProperty({ type: CommentAuthorViewDto })
  author: CommentAuthorViewDto;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Идентификатор родительского комментария (для ответов)',
  })
  parentId?: string | null;

  @ApiPropertyOptional({
    type: Number,
    example: 3,
    description: 'Количество активных ответов на комментарий',
  })
  repliesCount?: number;

  @ApiProperty({
    type: Number,
    example: 0,
    description: 'Общее количество лайков',
  })
  likesCount: number;

  @ApiProperty({
    type: Boolean,
    example: false,
    description: 'Поставил ли текущий пользователь лайк',
  })
  isLikedByCurrentUser: boolean;

  static mapToView(
    comment: CommentWithUserMetadata,
    isLikedByCurrentUser = false,
  ): CommentItemViewDto {
    const dto = new CommentItemViewDto();
    dto.id = comment.id.toString();
    dto.text = comment.text;
    dto.createdAt = comment.createdAt.toISOString();
    dto.author = CommentAuthorViewDto.mapToView({
      userId: comment.user.id,
      username: comment.user.username,
      avatarUrl: comment.user.profiles[0]?.avatarUrl ?? null,
    });
    dto.parentId = comment.parentId?.toString() ?? null;
    dto.repliesCount = comment._count.replies;
    dto.likesCount = comment._count.likes;
    dto.isLikedByCurrentUser = isLikedByCurrentUser;

    return dto;
  }
}
