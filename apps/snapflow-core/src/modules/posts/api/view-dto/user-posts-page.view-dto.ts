import { ApiProperty } from '@nestjs/swagger';
import { CursorPaginatedViewDto } from '../../../../../../../libs/dto/cursor-paginated.view-dto';
import { PostViewDto } from './post.view-dto';

export class UserPostsPageViewDto extends CursorPaginatedViewDto<PostViewDto> {
  @ApiProperty({ type: [PostViewDto] })
  declare items: PostViewDto[];
}
