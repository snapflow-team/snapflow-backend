import { ApiProperty } from '@nestjs/swagger';
import { CursorPaginatedViewDto } from '../../../../../../../../../libs/dto/cursor-paginated.view-dto';
import { UserSearchResultViewDto } from './user-search-result.view-dto';

export class SearchUsersPageViewDto extends CursorPaginatedViewDto<UserSearchResultViewDto> {
  @ApiProperty({ type: [UserSearchResultViewDto] })
  declare items: UserSearchResultViewDto[];
}
