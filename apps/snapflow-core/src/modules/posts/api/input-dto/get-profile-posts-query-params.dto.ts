import { BaseQueryParamsDto } from '../../../../../../../libs/dto/base-query.params.dto';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PostSortBy } from './get-posts.query-params.dto';
import { IsEnum } from 'class-validator';

export class GetProfilePostsQueryParamsDto extends BaseQueryParamsDto<PostSortBy> {
  @ApiPropertyOptional({
    description: 'Sort by filed',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsEnum(PostSortBy)
  sortBy: PostSortBy = PostSortBy.createdAt;

  @ApiPropertyOptional({ example: 8, default: 8 })
  override pageSize: number = 8;
}
