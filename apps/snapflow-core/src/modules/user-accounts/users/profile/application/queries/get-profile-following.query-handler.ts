import { ProfileFollowListQueryParamsDto } from '../../api/dto/input-dto/profile-follow-list.query-params.dto';

export class GetProfileFollowingQuery {
  constructor(
    public readonly profileId: number,
    public readonly query: ProfileFollowListQueryParamsDto,
    public readonly viewerUserId: number,
  ) {}
}
