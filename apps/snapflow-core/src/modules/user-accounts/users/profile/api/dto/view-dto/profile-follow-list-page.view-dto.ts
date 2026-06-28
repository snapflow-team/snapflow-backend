import { ApiProperty } from '@nestjs/swagger';
import { CursorPaginatedViewDto } from '../../../../../../../../../../libs/dto/cursor-paginated.view-dto';
import { ProfileFollowListItemViewDto } from './profile-follow-list-item.view-dto';

export class ProfileFollowListPageViewDto extends CursorPaginatedViewDto<ProfileFollowListItemViewDto> {
  @ApiProperty({ type: [ProfileFollowListItemViewDto] })
  declare items: ProfileFollowListItemViewDto[];
}
