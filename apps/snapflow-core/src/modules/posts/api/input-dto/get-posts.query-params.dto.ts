import { ApiPropertyOptional } from '@nestjs/swagger';
import { BaseQueryParamsDto } from '../../../../../../../libs/dto/base-query.params.dto';
import { IsEnum } from 'class-validator';

export enum PostSortBy {
  createdAt = 'createdAt',
}

export class GetPostsQueryParamsDto extends BaseQueryParamsDto<PostSortBy> {
  @ApiPropertyOptional({
    description: 'Sort by filed',
    example: 'createdAt',
    default: 'createdAt',
  })
  @IsEnum(PostSortBy)
  sortBy: PostSortBy = PostSortBy.createdAt;
}
