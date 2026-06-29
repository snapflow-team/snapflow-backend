import { ApiProperty } from '@nestjs/swagger';
import { CursorPaginatedViewDto } from '../../../../../../../../libs/dto/cursor-paginated.view-dto';
import { CommentItemViewDto } from './comment-item.view-dto';

export class PostCommentsPageViewDto extends CursorPaginatedViewDto<CommentItemViewDto> {
  @ApiProperty({ type: [CommentItemViewDto] })
  declare items: CommentItemViewDto[];
}
