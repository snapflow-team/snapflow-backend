import { ApiProperty } from '@nestjs/swagger';
import { PostViewDto } from './post.view-dto';

export class PostsPageViewDto {
  @ApiProperty({ example: 10 })
  pagesCount: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  pageSize: number;

  @ApiProperty({ example: 97 })
  totalCount: number;

  @ApiProperty({ type: [PostViewDto] })
  items: PostViewDto[];
}
